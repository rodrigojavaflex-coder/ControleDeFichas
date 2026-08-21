import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { VisitacaoMetaService } from '../../services/visitacao-meta.service';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  VisitacaoMetaItem,
  VisitacaoMetaListResponse,
} from '../../models/visitacao-meta.model';
import { MESES_PT, nomeMesPt } from '../folha/folha-meses';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';

interface MetaRow extends VisitacaoMetaItem {
  draft: string;
  salvando: boolean;
  editando: boolean;
}

@Component({
  selector: 'app-visitacao-metas-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent],
  templateUrl: './visitacao-metas-page.html',
  styleUrls: [
    '../vendas-list/vendas-list.css',
    '../producao/producao-config-page.css',
    './visitacao-metas-page.css',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class VisitacaoMetasPage implements OnInit {
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);
  private errors = inject(ErrorModalService);
  private service = inject(VisitacaoMetaService);

  MESES_PT = MESES_PT;

  unidadeFiltro: Unidade | '' = '';
  unidadeDisabled = false;
  /** 0 = todos os meses. */
  mesFiltro = new Date().getMonth() + 1;
  anoFiltro = 2026;
  anosDisponiveis: number[] = [];

  carregando = false;
  copiando = false;
  linhas: MetaRow[] = [];

  confirmVisivel = false;
  confirmTitulo = '';
  confirmMensagem = '';
  confirmVariante: 'danger' | 'primary' = 'primary';
  private confirmAcao: (() => void) | null = null;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Configuração Metas',
      description:
        'Meta mensal dos representantes com Filial do painel e Código representante painel preenchidos.',
    });
    for (let a = 2026; a <= 2033; a += 1) {
      this.anosDisponiveis.push(a);
    }
    this.initializeUnidadeFilter();
    if (this.unidadeFiltro) {
      this.carregarMetas();
    }
  }

  get unidadesVisiveis(): Unidade[] {
    return Object.values(Unidade);
  }

  podeLer(): boolean {
    return this.auth.hasPermission(Permission.VISITACAO_META_READ);
  }

  podeEditarMeta(): boolean {
    return this.auth.hasPermission(Permission.VISITACAO_META_UPDATE);
  }

  temLinhaEmEdicao(): boolean {
    return this.linhas.some((r) => r.editando);
  }

  nomeMes(mes: number): string {
    return nomeMesPt(mes);
  }

  onFiltroChange(): void {
    if (!this.unidadeFiltro) {
      this.linhas = [];
      return;
    }
    this.carregarMetas();
  }

  carregarMetas(): void {
    if (!this.unidadeFiltro || !this.podeLer()) return;
    this.carregando = true;
    const mes = this.mesFiltro > 0 ? this.mesFiltro : undefined;
    this.service.listar(this.unidadeFiltro, this.anoFiltro, mes).subscribe({
      next: (res) => {
        this.aplicarLista(res);
        this.carregando = false;
      },
      error: (e) => {
        this.carregando = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao carregar metas.',
          'Configuração Metas',
        );
      },
    });
  }

  incluirLinha(row: MetaRow): void {
    if (!this.podeEditarMeta() || this.temLinhaEmEdicao()) return;
    row.editando = true;
    row.draft = '';
  }

  alterarLinha(row: MetaRow): void {
    if (!this.podeEditarMeta() || this.temLinhaEmEdicao()) return;
    row.editando = true;
    row.draft = this.formatarMoedaInput(row.valorMeta);
  }

  cancelarEdicao(row: MetaRow): void {
    row.editando = false;
    row.draft = this.formatarMoedaInput(row.valorMeta);
    row.salvando = false;
  }

  formatarDraftBlur(row: MetaRow): void {
    const n = this.parseValor(row.draft);
    if (n == null) return;
    row.draft = this.formatarMoedaInput(n);
  }

  salvarLinha(row: MetaRow): void {
    if (!this.podeEditarMeta() || row.salvando || !row.editando) return;
    const valor = this.parseValor(row.draft);
    if (valor == null) {
      this.errors.show(
        'Informe um valor de meta válido (ex.: R$ 1.250,00).',
        'Configuração Metas',
      );
      return;
    }
    row.salvando = true;
    this.service
      .salvar({
        funcionarioId: row.funcionarioId,
        anoMes: row.anoMes,
        valorMeta: valor,
      })
      .subscribe({
        next: () => {
          this.carregarMetas();
        },
        error: (e) => {
          row.salvando = false;
          this.errors.show(
            e?.error?.message ?? 'Erro ao salvar meta.',
            'Configuração Metas',
          );
        },
      });
  }

  pedirCopiarMesAnterior(): void {
    if (!this.podeEditarMeta() || !this.unidadeFiltro || this.mesFiltro <= 0) {
      return;
    }
    const destino = this.anoMesSelecionado();
    const origem = this.mesAnterior(destino);
    this.abrirConfirmacao(
      'Copiar mês anterior',
      `Copiar as metas de ${this.rotuloAnoMes(origem)} para ${this.rotuloAnoMes(destino)}? Valores já cadastrados no destino serão substituídos.`,
      () => this.copiarMesAnterior(origem, destino),
      'primary',
    );
  }

  confirmarAcao(): void {
    const acao = this.confirmAcao;
    this.confirmVisivel = false;
    this.confirmAcao = null;
    acao?.();
  }

  cancelarConfirmacao(): void {
    this.confirmVisivel = false;
    this.confirmAcao = null;
  }

  formatarMoeda(valor: number | null): string {
    if (valor == null) return '—';
    return this.moedaFmt.format(valor);
  }

  private readonly moedaFmt = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  private formatarMoedaInput(valor: number | null): string {
    if (valor == null) return '';
    return this.moedaFmt.format(valor);
  }

  private parseValor(texto: string): number | null {
    let t = texto.trim().replace(/\s/g, '').replace(/r\$/gi, '');
    if (t === '') return null;
    if (t.includes(',') && /\.\d{3}/.test(t)) {
      t = t.replace(/\./g, '').replace(',', '.');
    } else if (t.includes(',') && t.includes('.')) {
      const lastComma = t.lastIndexOf(',');
      const lastDot = t.lastIndexOf('.');
      t =
        lastComma > lastDot
          ? t.replace(/\./g, '').replace(',', '.')
          : t.replace(/,/g, '');
    } else if (t.includes(',')) {
      t = t.replace(',', '.');
    }
    const n = Number.parseFloat(t);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
  }

  private copiarMesAnterior(origem: string, destino: string): void {
    if (!this.unidadeFiltro) return;
    this.copiando = true;
    this.service
      .copiar({
        unidade: this.unidadeFiltro,
        anoMesOrigem: origem,
        anoMesDestino: destino,
      })
      .subscribe({
        next: () => {
          this.copiando = false;
          this.carregarMetas();
        },
        error: (e) => {
          this.copiando = false;
          this.errors.show(
            e?.error?.message ?? 'Erro ao copiar metas do mês anterior.',
            'Configuração Metas',
          );
        },
      });
  }

  private aplicarLista(res: VisitacaoMetaListResponse): void {
    this.linhas = res.itens.map((item) => ({
      ...item,
      draft: this.formatarMoedaInput(item.valorMeta),
      salvando: false,
      editando: false,
    }));
  }

  private initializeUnidadeFilter(): void {
    const raw = this.auth.getCurrentUser()?.unidade?.trim() ?? '';
    const match = this.unidadesVisiveis.find((u) => u === raw);
    if (match) {
      this.unidadeFiltro = match;
      this.unidadeDisabled = true;
    } else {
      this.unidadeFiltro = '';
      this.unidadeDisabled = false;
    }
  }

  private anoMesSelecionado(): string {
    return `${this.anoFiltro}-${String(this.mesFiltro).padStart(2, '0')}`;
  }

  private abrirConfirmacao(
    titulo: string,
    mensagem: string,
    acao: () => void,
    variante: 'danger' | 'primary' = 'primary',
  ): void {
    this.confirmTitulo = titulo;
    this.confirmMensagem = mensagem;
    this.confirmAcao = acao;
    this.confirmVariante = variante;
    this.confirmVisivel = true;
  }

  private mesAnterior(anoMes: string): string {
    const [ano, mes] = anoMes.split('-').map((n) => Number(n));
    const data = new Date(ano, mes - 2, 1);
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
  }

  private rotuloAnoMes(anoMes: string): string {
    const [ano, mes] = anoMes.split('-').map((n) => Number(n));
    return `${nomeMesPt(mes)}/${ano}`;
  }
}
