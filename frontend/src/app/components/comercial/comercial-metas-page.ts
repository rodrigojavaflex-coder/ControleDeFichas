import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ComercialMetaService } from '../../services/comercial-meta.service';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  ComercialMetaItem,
  ComercialMetaListResponse,
  ComercialTipoBase,
} from '../../models/comercial-meta.model';
import { MESES_PT, nomeMesPt } from '../folha/folha-meses';

interface MetaRow extends ComercialMetaItem {
  draftRequisicao: string;
  draftMarcaPropria: string;
  editando: boolean;
  salvando: boolean;
}

@Component({
  selector: 'app-comercial-metas-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './comercial-metas-page.html',
  styleUrls: [
    '../vendas-list/vendas-list.css',
    '../producao/producao-config-page.css',
    './comercial-metas-page.css',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class ComercialMetasPage implements OnInit {
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);
  private errors = inject(ErrorModalService);
  private service = inject(ComercialMetaService);

  MESES_PT = MESES_PT;

  unidadeFiltro: Unidade | '' = '';
  unidadeDisabled = false;
  mesFiltro = new Date().getMonth() + 1;
  anoFiltro = 2026;
  anosDisponiveis: number[] = [];

  carregando = false;
  copiando = false;
  linhas: MetaRow[] = [];

  metaUnidadeRequisicao: number | null = null;
  metaUnidadeMarcaPropria: number | null = null;
  draftUnidadeRequisicao = '';
  draftUnidadeMarcaPropria = '';
  editandoUnidade = false;
  salvandoUnidade = false;

  copiarModalVisivel = false;
  copiarOrigem = '';
  copiarDestino = '';
  percentualAumentoRequisicao = '';
  percentualAumentoMarcaPropria = '';

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Configuração Metas Comercial',
      description:
        'Metas mensais da loja e dos vendedores (manipulados e marca própria).',
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
    return this.auth.hasPermission(Permission.COMERCIAL_META_READ);
  }

  podeEditarMeta(): boolean {
    return this.auth.hasPermission(Permission.COMERCIAL_META_UPDATE);
  }

  temLinhaEmEdicao(): boolean {
    return this.linhas.some((r) => r.editando) || this.editandoUnidade;
  }

  mostrarMetaUnidade(): boolean {
    return this.mesFiltro > 0;
  }

  temMetasCadastradas(row: MetaRow): boolean {
    return row.valorMetaRequisicao != null || row.valorMetaMarcaPropria != null;
  }

  nomeMes(mes: number): string {
    return nomeMesPt(mes);
  }

  onFiltroChange(): void {
    this.editandoUnidade = false;
    if (!this.unidadeFiltro) {
      this.linhas = [];
      this.metaUnidadeRequisicao = null;
      this.metaUnidadeMarcaPropria = null;
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
          e?.error?.message ?? 'Erro ao carregar metas comerciais.',
          'Configuração Metas Comercial',
        );
      },
    });
  }

  incluirUnidade(): void {
    if (!this.podeEditarMeta() || this.temLinhaEmEdicao()) return;
    this.editandoUnidade = true;
    this.draftUnidadeRequisicao = '';
    this.draftUnidadeMarcaPropria = '';
  }

  alterarUnidade(): void {
    if (!this.podeEditarMeta() || this.temLinhaEmEdicao()) return;
    this.editandoUnidade = true;
    this.draftUnidadeRequisicao = this.formatarMoedaInput(
      this.metaUnidadeRequisicao,
    );
    this.draftUnidadeMarcaPropria = this.formatarMoedaInput(
      this.metaUnidadeMarcaPropria,
    );
  }

  cancelarUnidade(): void {
    this.editandoUnidade = false;
    this.salvandoUnidade = false;
    this.draftUnidadeRequisicao = this.formatarMoedaInput(
      this.metaUnidadeRequisicao,
    );
    this.draftUnidadeMarcaPropria = this.formatarMoedaInput(
      this.metaUnidadeMarcaPropria,
    );
  }

  formatarDraftUnidade(campo: 'requisicao' | 'marcaPropria'): void {
    if (campo === 'requisicao') {
      this.draftUnidadeRequisicao = this.formatarMoedaDigitacao(
        this.draftUnidadeRequisicao,
      );
    } else {
      this.draftUnidadeMarcaPropria = this.formatarMoedaDigitacao(
        this.draftUnidadeMarcaPropria,
      );
    }
  }

  salvarUnidade(): void {
    if (!this.podeEditarMeta() || this.salvandoUnidade || !this.unidadeFiltro) {
      return;
    }
    const valorReq = this.parseValor(this.draftUnidadeRequisicao);
    const valorMp = this.parseValor(this.draftUnidadeMarcaPropria);
    if (valorReq == null || valorMp == null) {
      this.errors.show(
        'Informe as duas metas da loja (Manipulados e Marca própria).',
        'Configuração Metas Comercial',
      );
      return;
    }
    this.salvandoUnidade = true;
    this.service
      .salvarUnidade({
        unidade: this.unidadeFiltro,
        anoMes: this.anoMesSelecionado(),
        valorMetaRequisicao: valorReq,
        valorMetaMarcaPropria: valorMp,
      })
      .subscribe({
        next: (res) => {
          this.aplicarLista(res);
          this.salvandoUnidade = false;
          this.editandoUnidade = false;
        },
        error: (e) => {
          this.salvandoUnidade = false;
          this.errors.show(
            e?.error?.message ?? 'Erro ao salvar metas da loja.',
            'Configuração Metas Comercial',
          );
        },
      });
  }

  temMetaUnidadeCadastrada(): boolean {
    return (
      this.metaUnidadeRequisicao != null || this.metaUnidadeMarcaPropria != null
    );
  }

  incluirLinha(row: MetaRow): void {
    if (!this.podeEditarMeta() || this.temLinhaEmEdicao()) return;
    row.editando = true;
    row.draftRequisicao = '';
    row.draftMarcaPropria = '';
  }

  alterarLinha(row: MetaRow): void {
    if (!this.podeEditarMeta() || this.temLinhaEmEdicao()) return;
    row.editando = true;
    row.draftRequisicao = this.formatarMoedaInput(row.valorMetaRequisicao);
    row.draftMarcaPropria = this.formatarMoedaInput(row.valorMetaMarcaPropria);
  }

  cancelarEdicao(row: MetaRow): void {
    row.editando = false;
    row.salvando = false;
    row.draftRequisicao = this.formatarMoedaInput(row.valorMetaRequisicao);
    row.draftMarcaPropria = this.formatarMoedaInput(row.valorMetaMarcaPropria);
  }

  formatarDraftDigitacao(row: MetaRow, campo: 'requisicao' | 'marcaPropria'): void {
    if (campo === 'requisicao') {
      row.draftRequisicao = this.formatarMoedaDigitacao(row.draftRequisicao);
    } else {
      row.draftMarcaPropria = this.formatarMoedaDigitacao(row.draftMarcaPropria);
    }
  }

  salvarLinha(row: MetaRow): void {
    if (!this.podeEditarMeta() || row.salvando || !row.editando) return;
    const valorReq = this.parseValor(row.draftRequisicao);
    const valorMp = this.parseValor(row.draftMarcaPropria);
    if (valorReq == null || valorMp == null) {
      this.errors.show(
        'Informe as duas metas (Manipulados e Marca própria), por exemplo R$ 1.250,00.',
        'Configuração Metas Comercial',
      );
      return;
    }
    row.salvando = true;
    forkJoin([
      this.service.salvar({
        funcionarioId: row.funcionarioId,
        anoMes: row.anoMes,
        tipoBase: ComercialTipoBase.REQUISICAO,
        valorMeta: valorReq,
      }),
      this.service.salvar({
        funcionarioId: row.funcionarioId,
        anoMes: row.anoMes,
        tipoBase: ComercialTipoBase.MARCA_PROPRIA,
        valorMeta: valorMp,
      }),
    ]).subscribe({
      next: () => {
        this.carregarMetas();
      },
      error: (e) => {
        row.salvando = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao salvar metas.',
          'Configuração Metas Comercial',
        );
      },
    });
  }

  pedirCopiarMesAnterior(): void {
    if (!this.podeEditarMeta() || !this.unidadeFiltro || this.mesFiltro <= 0) {
      return;
    }
    this.copiarDestino = this.anoMesSelecionado();
    this.copiarOrigem = this.mesAnterior(this.copiarDestino);
    this.percentualAumentoRequisicao = '0';
    this.percentualAumentoMarcaPropria = '0';
    this.copiarModalVisivel = true;
  }

  rotuloCopiarOrigem(): string {
    return this.rotuloAnoMes(this.copiarOrigem);
  }

  rotuloCopiarDestino(): string {
    return this.rotuloAnoMes(this.copiarDestino);
  }

  confirmarCopia(): void {
    const pctReq = this.parsePercentual(this.percentualAumentoRequisicao);
    const pctMp = this.parsePercentual(this.percentualAumentoMarcaPropria);
    if (pctReq == null || pctMp == null) {
      this.errors.show(
        'Informe percentuais de aumento válidos (0 a 999,99). Deixe 0 para copiar o valor sem aumento.',
        'Copiar mês anterior',
      );
      return;
    }
    this.copiarModalVisivel = false;
    this.copiarMesAnterior(this.copiarOrigem, this.copiarDestino, pctReq, pctMp);
  }

  cancelarCopia(): void {
    this.copiarModalVisivel = false;
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

  private formatarMoedaDigitacao(texto: string): string {
    const digits = texto.replace(/\D/g, '');
    if (!digits) return '';
    const cents = Number.parseInt(digits, 10);
    if (!Number.isFinite(cents) || cents < 0) return '';
    return this.moedaFmt.format(cents / 100);
  }

  private parseValor(texto: string): number | null {
    const digits = texto.replace(/\D/g, '');
    if (!digits) return null;
    const cents = Number.parseInt(digits, 10);
    if (!Number.isFinite(cents) || cents < 0) return null;
    return Math.round(cents) / 100;
  }

  private parsePercentual(texto: string): number | null {
    const t = texto.trim().replace(/\s/g, '').replace('%', '').replace(',', '.');
    if (t === '') return 0;
    const n = Number.parseFloat(t);
    if (!Number.isFinite(n) || n < 0 || n > 999.99) return null;
    return Math.round(n * 100) / 100;
  }

  private copiarMesAnterior(
    origem: string,
    destino: string,
    percentualAumentoRequisicao: number,
    percentualAumentoMarcaPropria: number,
  ): void {
    if (!this.unidadeFiltro) return;
    this.copiando = true;
    this.service
      .copiar({
        unidade: this.unidadeFiltro,
        anoMesOrigem: origem,
        anoMesDestino: destino,
        percentualAumentoRequisicao,
        percentualAumentoMarcaPropria,
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
            'Configuração Metas Comercial',
          );
        },
      });
  }

  private aplicarLista(res: ComercialMetaListResponse): void {
    this.metaUnidadeRequisicao = res.metaUnidadeRequisicao ?? null;
    this.metaUnidadeMarcaPropria = res.metaUnidadeMarcaPropria ?? null;
    this.draftUnidadeRequisicao = this.formatarMoedaInput(
      this.metaUnidadeRequisicao,
    );
    this.draftUnidadeMarcaPropria = this.formatarMoedaInput(
      this.metaUnidadeMarcaPropria,
    );
    this.editandoUnidade = false;
    this.salvandoUnidade = false;
    this.linhas = res.itens.map((item) => ({
      ...item,
      draftRequisicao: this.formatarMoedaInput(item.valorMetaRequisicao),
      draftMarcaPropria: this.formatarMoedaInput(item.valorMetaMarcaPropria),
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
