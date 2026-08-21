import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { VisitacaoComissaoService } from '../../services/visitacao-comissao.service';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  VisitacaoComissaoFaixaItem,
  VisitacaoComissaoRepresentanteItem,
} from '../../models/visitacao-comissao.model';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';

interface FaixaRow {
  localId: string;
  id: string | null;
  percentualMetaDe: number | null;
  percentualMetaAte: number | null;
  percentualComissao: number | null;
  draftDe: string;
  draftAte: string;
  draftComissao: string;
  editando: boolean;
  salvando: boolean;
}

@Component({
  selector: 'app-visitacao-comissoes-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent],
  templateUrl: './visitacao-comissoes-page.html',
  styleUrls: [
    '../vendas-list/vendas-list.css',
    '../producao/producao-config-page.css',
    './visitacao-comissoes-page.css',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class VisitacaoComissoesPage implements OnInit {
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);
  private errors = inject(ErrorModalService);
  private service = inject(VisitacaoComissaoService);

  unidadeFiltro: Unidade | '' = '';
  unidadeDisabled = false;
  funcionarioId: string = '';
  representantes: VisitacaoComissaoRepresentanteItem[] = [];
  carregandoReps = false;

  linhas: FaixaRow[] = [];
  carregandoFaixas = false;
  carregandoPadrao = false;

  confirmVisivel = false;
  confirmTitulo = '';
  confirmMensagem = '';
  confirmVariante: 'danger' | 'primary' = 'primary';
  private confirmAcao: (() => void) | null = null;
  private seqLocal = 0;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Configuração Comissões',
      description:
        'Faixas de comissão por representante da unidade do usuário, com Filial do painel e Código representante painel preenchidos.',
    });
    this.initializeUnidadeFilter();
    if (this.unidadeFiltro) {
      this.carregarRepresentantes();
    }
  }

  get unidadesVisiveis(): Unidade[] {
    return Object.values(Unidade);
  }

  podeLer(): boolean {
    return this.auth.hasPermission(Permission.VISITACAO_COMISSAO_READ);
  }

  podeIncluirFaixa(): boolean {
    return this.auth.hasPermission(Permission.VISITACAO_COMISSAO_CREATE);
  }

  podeEditarFaixa(): boolean {
    return this.auth.hasPermission(Permission.VISITACAO_COMISSAO_UPDATE);
  }

  podeExcluirFaixa(): boolean {
    return this.auth.hasPermission(Permission.VISITACAO_COMISSAO_DELETE);
  }

  mostrarAcoesFaixa(): boolean {
    return (
      this.podeIncluirFaixa() ||
      this.podeEditarFaixa() ||
      this.podeExcluirFaixa()
    );
  }

  temLinhaEmEdicao(): boolean {
    return this.linhas.some((r) => r.editando);
  }

  podeSalvarLinha(row: FaixaRow): boolean {
    return row.id ? this.podeEditarFaixa() : this.podeIncluirFaixa();
  }

  rotuloRepresentante(r: VisitacaoComissaoRepresentanteItem): string {
    return `${r.nome} (${r.painelContratoRepresentante}/${r.painelCodigoRepresentante})`;
  }

  onUnidadeChange(): void {
    this.funcionarioId = '';
    this.representantes = [];
    this.linhas = [];
    if (!this.unidadeFiltro) return;
    this.carregarRepresentantes();
  }

  onRepresentanteChange(): void {
    this.linhas = [];
    if (!this.funcionarioId) return;
    this.carregarFaixas();
  }

  incluirFaixaNaGrade(): void {
    if (!this.podeIncluirFaixa() || this.temLinhaEmEdicao()) return;
    this.linhas = [
      ...this.linhas,
      {
        localId: this.novoLocalId(),
        id: null,
        percentualMetaDe: null,
        percentualMetaAte: null,
        percentualComissao: null,
        draftDe: '',
        draftAte: '',
        draftComissao: '',
        editando: true,
        salvando: false,
      },
    ];
  }

  alterarLinha(row: FaixaRow): void {
    if (!this.podeEditarFaixa() || this.temLinhaEmEdicao()) return;
    row.editando = true;
    row.draftDe = this.formatNumero(row.percentualMetaDe);
    row.draftAte = this.formatNumero(row.percentualMetaAte);
    row.draftComissao = this.formatNumero(row.percentualComissao);
  }

  cancelarEdicao(row: FaixaRow): void {
    if (!row.id) {
      this.linhas = this.linhas.filter((r) => r.localId !== row.localId);
      return;
    }
    row.editando = false;
    row.salvando = false;
    row.draftDe = this.formatNumero(row.percentualMetaDe);
    row.draftAte = this.formatNumero(row.percentualMetaAte);
    row.draftComissao = this.formatNumero(row.percentualComissao);
  }

  salvarLinha(row: FaixaRow): void {
    if (!this.podeSalvarLinha(row) || row.salvando || !this.funcionarioId) {
      return;
    }
    const de = this.parseNumero(row.draftDe);
    const comissao = this.parseNumero(row.draftComissao);
    const ate =
      row.draftAte.trim() === '' ? null : this.parseNumero(row.draftAte);
    if (
      de == null ||
      comissao == null ||
      (row.draftAte.trim() !== '' && ate == null)
    ) {
      this.errors.show(
        'Informe percentuais válidos na faixa (Até pode ficar vazio = sem teto).',
        'Comissões',
      );
      return;
    }
    const dto = {
      funcionarioId: this.funcionarioId,
      percentualMetaDe: de,
      percentualMetaAte: ate,
      percentualComissao: comissao,
    };
    row.salvando = true;
    const req = row.id
      ? this.service.atualizarFaixa(row.id, dto)
      : this.service.criarFaixa(dto);
    req.subscribe({
      next: (lista) => {
        this.aplicarLista(lista);
      },
      error: (e) => {
        row.salvando = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao salvar faixa.',
          'Comissões',
        );
      },
    });
  }

  pedirExcluirFaixa(row: FaixaRow): void {
    if (!this.podeExcluirFaixa() || !row.id) return;
    this.abrirConfirmacao(
      'Excluir faixa',
      `Excluir a faixa ${this.formatarFaixaRow(row)}?`,
      () => this.excluirFaixa(row.id!),
      'danger',
    );
  }

  pedirCarregarPadrao(): void {
    if (!this.podeIncluirFaixa() || !this.funcionarioId) return;
    const gravadas = this.linhas.filter((r) => r.id).length;
    const mensagem =
      gravadas > 0
        ? 'Substituir as faixas atuais pelas faixas padrão (0%, 1%, 1,5%, 2% e 2,5%)?'
        : 'Carregar as faixas padrão (0%, 1%, 1,5%, 2% e 2,5%) para este representante?';
    this.abrirConfirmacao(
      'Carregar faixas padrão',
      mensagem,
      () => this.carregarPadrao(),
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

  formatarPercentual(valor: number | null): string {
    if (valor == null) return 'sem teto';
    return `${this.formatNumero(valor)}%`;
  }

  private formatarFaixaRow(row: FaixaRow): string {
    const ate =
      row.percentualMetaAte == null
        ? 'sem teto'
        : this.formatNumero(row.percentualMetaAte);
    return `${this.formatNumero(row.percentualMetaDe)}% a ${ate}`;
  }

  private carregarRepresentantes(): void {
    if (!this.unidadeFiltro || !this.podeLer()) return;
    this.carregandoReps = true;
    this.service.listarRepresentantes(this.unidadeFiltro).subscribe({
      next: (res) => {
        this.representantes = res.itens;
        this.carregandoReps = false;
        if (this.representantes.length === 1) {
          this.funcionarioId = this.representantes[0].funcionarioId;
          this.carregarFaixas();
        } else if (
          this.funcionarioId &&
          !this.representantes.some((r) => r.funcionarioId === this.funcionarioId)
        ) {
          this.funcionarioId = '';
          this.linhas = [];
        }
      },
      error: (e) => {
        this.carregandoReps = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao carregar representantes.',
          'Comissões',
        );
      },
    });
  }

  private carregarFaixas(): void {
    if (!this.funcionarioId || !this.podeLer()) return;
    this.carregandoFaixas = true;
    this.service.listarFaixas(this.funcionarioId).subscribe({
      next: (lista) => {
        this.aplicarLista(lista);
        this.carregandoFaixas = false;
      },
      error: (e) => {
        this.carregandoFaixas = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao carregar faixas.',
          'Comissões',
        );
      },
    });
  }

  private excluirFaixa(id: string): void {
    this.service.excluirFaixa(id).subscribe({
      next: (lista) => {
        this.aplicarLista(lista);
      },
      error: (e) => {
        this.errors.show(
          e?.error?.message ?? 'Erro ao excluir faixa.',
          'Comissões',
        );
      },
    });
  }

  private carregarPadrao(): void {
    if (!this.funcionarioId) return;
    this.carregandoPadrao = true;
    this.service.carregarPadrao(this.funcionarioId).subscribe({
      next: (lista) => {
        this.aplicarLista(lista);
        this.carregandoPadrao = false;
      },
      error: (e) => {
        this.carregandoPadrao = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao carregar faixas padrão.',
          'Comissões',
        );
      },
    });
  }

  private aplicarLista(lista: VisitacaoComissaoFaixaItem[]): void {
    this.linhas = lista.map((item) => this.paraLinha(item));
    this.atualizarContagemFaixas(lista.length);
  }

  private paraLinha(item: VisitacaoComissaoFaixaItem): FaixaRow {
    return {
      localId: item.id,
      id: item.id,
      percentualMetaDe: item.percentualMetaDe,
      percentualMetaAte: item.percentualMetaAte,
      percentualComissao: item.percentualComissao,
      draftDe: this.formatNumero(item.percentualMetaDe),
      draftAte: this.formatNumero(item.percentualMetaAte),
      draftComissao: this.formatNumero(item.percentualComissao),
      editando: false,
      salvando: false,
    };
  }

  private atualizarContagemFaixas(qtd: number): void {
    const atual = this.representantes.find(
      (r) => r.funcionarioId === this.funcionarioId,
    );
    if (atual) atual.faixasCount = qtd;
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

  private novoLocalId(): string {
    this.seqLocal += 1;
    return `nova-${this.seqLocal}`;
  }

  private parseNumero(texto: string): number | null {
    const bruto = texto.trim();
    if (bruto === '') return null;
    const limpo = bruto.includes(',')
      ? bruto.replace(/\./g, '').replace(',', '.')
      : bruto;
    const n = Number(limpo);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
  }

  private formatNumero(valor: number | null): string {
    if (valor == null) return '';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(valor);
  }
}
