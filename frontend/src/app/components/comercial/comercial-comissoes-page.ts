import { Component, OnInit, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ComercialComissaoService } from '../../services/comercial-comissao.service';
import {
  ComercialComissaoFaixaItem,
  ComercialComissaoVendedorItem,
} from '../../models/comercial-comissao.model';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  ComercialIncidenciaComissao,
  ComercialTipoBase,
} from '../../models/comercial-meta.model';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';

interface FaixaRow {
  localId: string;
  id: string | null;
  tipoBase: ComercialTipoBase;
  percentualMetaDe: number | null;
  percentualMetaAte: number | null;
  percentualComissao: number | null;
  valorBonus: number | null;
  draftDe: string;
  draftAte: string;
  draftComissao: string;
  draftBonus: string;
  editando: boolean;
  salvando: boolean;
}

interface FaixaGrade {
  tipoBase: ComercialTipoBase;
  titulo: string;
  linhas: FaixaRow[];
  carregando: boolean;
  carregandoPadrao: boolean;
  incidencia: ComercialIncidenciaComissao;
  percentualMinimoLoja: number | null;
  draftIncidencia: ComercialIncidenciaComissao;
  draftMinimoLoja: string;
  politicaSalvando: boolean;
}

@Component({
  selector: 'app-comercial-comissoes-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent],
  templateUrl: './comercial-comissoes-page.html',
  styleUrls: [
    '../vendas-list/vendas-list.css',
    '../producao/producao-config-page.css',
    './comercial-comissoes-page.css',
  ],
  encapsulation: ViewEncapsulation.None,
})
export class ComercialComissoesPage implements OnInit {
  private pageCtx = inject(PageContextService);
  private auth = inject(AuthService);
  private errors = inject(ErrorModalService);
  private service = inject(ComercialComissaoService);

  readonly ComercialIncidenciaComissao = ComercialIncidenciaComissao;
  readonly grades: FaixaGrade[] = [
    {
      tipoBase: ComercialTipoBase.REQUISICAO,
      titulo: 'Manipulados',
      linhas: [],
      carregando: false,
      carregandoPadrao: false,
      incidencia: ComercialIncidenciaComissao.PROPRIAS,
      percentualMinimoLoja: null,
      draftIncidencia: ComercialIncidenciaComissao.PROPRIAS,
      draftMinimoLoja: '',
      politicaSalvando: false,
    },
    {
      tipoBase: ComercialTipoBase.MARCA_PROPRIA,
      titulo: 'Marca própria',
      linhas: [],
      carregando: false,
      carregandoPadrao: false,
      incidencia: ComercialIncidenciaComissao.PROPRIAS,
      percentualMinimoLoja: null,
      draftIncidencia: ComercialIncidenciaComissao.PROPRIAS,
      draftMinimoLoja: '',
      politicaSalvando: false,
    },
  ];

  unidadeFiltro: Unidade | '' = '';
  unidadeDisabled = false;
  funcionarioId = '';
  vendedores: ComercialComissaoVendedorItem[] = [];
  carregandoVendedores = false;
  carregandoPendentes = false;
  mensagemResultado = '';

  confirmVisivel = false;
  confirmTitulo = '';
  confirmMensagem = '';
  confirmVariante: 'danger' | 'primary' = 'primary';
  private confirmAcao: (() => void) | null = null;
  private seqLocal = 0;

  ngOnInit(): void {
    this.pageCtx.setContext({
      title: 'Configuração Comissões Comercial',
      description:
        'Faixas e regra de cálculo (vendas próprias ou da loja, com trava da meta da loja).',
    });
    this.initializeUnidadeFilter();
    if (this.unidadeFiltro) {
      this.carregarVendedores();
    }
  }

  get unidadesVisiveis(): Unidade[] {
    return Object.values(Unidade);
  }

  podeLer(): boolean {
    return this.auth.hasPermission(Permission.COMERCIAL_COMISSAO_READ);
  }

  podeIncluirFaixa(): boolean {
    return this.auth.hasPermission(Permission.COMERCIAL_COMISSAO_CREATE);
  }

  podeEditarFaixa(): boolean {
    return this.auth.hasPermission(Permission.COMERCIAL_COMISSAO_UPDATE);
  }

  podeEditarPolitica(): boolean {
    return (
      this.auth.hasPermission(Permission.COMERCIAL_COMISSAO_UPDATE) ||
      this.auth.hasPermission(Permission.COMERCIAL_COMISSAO_CREATE)
    );
  }

  podeExcluirFaixa(): boolean {
    return this.auth.hasPermission(Permission.COMERCIAL_COMISSAO_DELETE);
  }

  mostrarAcoesFaixa(): boolean {
    return (
      this.podeIncluirFaixa() ||
      this.podeEditarFaixa() ||
      this.podeExcluirFaixa()
    );
  }

  temLinhaEmEdicao(): boolean {
    return this.grades.some((g) => g.linhas.some((r) => r.editando));
  }

  podeSalvarLinha(row: FaixaRow): boolean {
    return row.id ? this.podeEditarFaixa() : this.podeIncluirFaixa();
  }

  rotuloVendedor(v: ComercialComissaoVendedorItem): string {
    return `${v.nome} (${v.codigoVendedorErp})`;
  }

  onUnidadeChange(): void {
    this.funcionarioId = '';
    this.vendedores = [];
    this.limparGrades();
    this.mensagemResultado = '';
    if (!this.unidadeFiltro) return;
    this.carregarVendedores();
  }

  onVendedorChange(): void {
    this.limparGrades();
    if (!this.funcionarioId) return;
    this.carregarFaixas();
    this.carregarPolitica();
  }

  incluirFaixaNaGrade(grade: FaixaGrade): void {
    if (!this.podeIncluirFaixa() || this.temLinhaEmEdicao()) return;
    grade.linhas = [
      ...grade.linhas,
      {
        localId: this.novoLocalId(),
        id: null,
        tipoBase: grade.tipoBase,
        percentualMetaDe: null,
        percentualMetaAte: null,
        percentualComissao: null,
        valorBonus: null,
        draftDe: '',
        draftAte: '',
        draftComissao: '',
        draftBonus: '',
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
    row.draftBonus = this.formatarMoedaInput(row.valorBonus);
  }

  cancelarEdicao(row: FaixaRow, grade: FaixaGrade): void {
    if (!row.id) {
      grade.linhas = grade.linhas.filter((r) => r.localId !== row.localId);
      return;
    }
    row.editando = false;
    row.salvando = false;
    row.draftDe = this.formatNumero(row.percentualMetaDe);
    row.draftAte = this.formatNumero(row.percentualMetaAte);
    row.draftComissao = this.formatNumero(row.percentualComissao);
    row.draftBonus = this.formatarMoedaInput(row.valorBonus);
  }

  salvarLinha(row: FaixaRow, grade: FaixaGrade): void {
    if (!this.podeSalvarLinha(row) || row.salvando || !this.funcionarioId) {
      return;
    }
    const de = this.parseNumero(row.draftDe);
    const comissao = this.parseNumero(row.draftComissao);
    const ate =
      row.draftAte.trim() === '' ? null : this.parseNumero(row.draftAte);
    const bonus =
      row.draftBonus.trim() === '' ? 0 : this.parseValorMoeda(row.draftBonus);
    if (
      de == null ||
      comissao == null ||
      bonus == null ||
      (row.draftAte.trim() !== '' && ate == null)
    ) {
      this.errors.show(
        'Informe percentuais válidos na faixa (Até pode ficar vazio = sem teto) e um bônus em R$ (0 se não houver).',
        'Comissões Comercial',
      );
      return;
    }
    const dto = {
      funcionarioId: this.funcionarioId,
      tipoBase: grade.tipoBase,
      percentualMetaDe: de,
      percentualMetaAte: ate,
      percentualComissao: comissao,
      valorBonus: bonus,
    };
    row.salvando = true;
    const req = row.id
      ? this.service.atualizarFaixa(row.id, dto)
      : this.service.criarFaixa(dto);
    req.subscribe({
      next: (lista) => {
        this.aplicarLista(grade, lista);
      },
      error: (e) => {
        row.salvando = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao salvar faixa.',
          'Comissões Comercial',
        );
      },
    });
  }

  pedirExcluirFaixa(row: FaixaRow, grade: FaixaGrade): void {
    if (!this.podeExcluirFaixa() || !row.id) return;
    this.abrirConfirmacao(
      'Excluir faixa',
      `Excluir a faixa ${this.formatarFaixaRow(row)} de ${grade.titulo}?`,
      () => this.excluirFaixa(row.id!, grade),
      'danger',
    );
  }

  pedirCarregarPadrao(grade: FaixaGrade): void {
    if (!this.podeIncluirFaixa() || !this.funcionarioId) return;
    const gravadas = grade.linhas.filter((r) => r.id).length;
    const rotulo = this.rotuloFaixasPadrao(grade.tipoBase);
    const mensagem =
      gravadas > 0
        ? `Substituir as faixas atuais de ${grade.titulo} pelas faixas padrão (${rotulo})?`
        : `Carregar as faixas padrão de ${grade.titulo} (${rotulo}) para este vendedor?`;
    this.abrirConfirmacao(
      `Carregar faixas padrão — ${grade.titulo}`,
      mensagem,
      () => this.carregarPadrao(grade),
      'primary',
    );
  }

  pedirCarregarPendentes(): void {
    if (!this.podeIncluirFaixa() || !this.unidadeFiltro) return;
    this.abrirConfirmacao(
      'Carregar faixas pendentes',
      `Carregar as faixas padrão de Manipulados e Marca própria para todos os vendedores de ${this.unidadeFiltro} que ainda não tiverem cadastro em alguma das duas bases? Faixas já cadastradas não serão alteradas.`,
      () => this.carregarPendentes(),
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

  formatarBonus(valor: number | null): string {
    if (valor == null || valor === 0) return '—';
    return this.moedaFmt.format(valor);
  }

  formatarDraftBonus(row: FaixaRow): void {
    row.draftBonus = this.formatarMoedaDigitacao(row.draftBonus);
  }

  private formatarFaixaRow(row: FaixaRow): string {
    const ate =
      row.percentualMetaAte == null
        ? 'sem teto'
        : this.formatNumero(row.percentualMetaAte);
    return `${this.formatNumero(row.percentualMetaDe)}% a ${ate}`;
  }

  private carregarVendedores(): void {
    if (!this.unidadeFiltro || !this.podeLer()) return;
    this.carregandoVendedores = true;
    this.service.listarVendedores(this.unidadeFiltro).subscribe({
      next: (res) => {
        this.vendedores = res.itens;
        this.carregandoVendedores = false;
        if (this.vendedores.length === 1) {
          this.funcionarioId = this.vendedores[0].funcionarioId;
          this.carregarFaixas();
          this.carregarPolitica();
        } else if (
          this.funcionarioId &&
          !this.vendedores.some((v) => v.funcionarioId === this.funcionarioId)
        ) {
          this.funcionarioId = '';
          this.limparGrades();
        }
      },
      error: (e) => {
        this.carregandoVendedores = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao carregar vendedores.',
          'Comissões Comercial',
        );
      },
    });
  }

  private carregarFaixas(): void {
    for (const grade of this.grades) {
      this.carregarFaixasDaGrade(grade);
    }
  }

  private carregarFaixasDaGrade(grade: FaixaGrade): void {
    const funcionarioId = this.funcionarioId;
    if (!funcionarioId || !this.podeLer()) return;
    grade.carregando = true;
    this.service.listarFaixas(funcionarioId, grade.tipoBase).subscribe({
      next: (lista) => {
        if (this.funcionarioId !== funcionarioId) return;
        this.aplicarLista(grade, lista);
        grade.carregando = false;
      },
      error: (e) => {
        if (this.funcionarioId !== funcionarioId) return;
        grade.carregando = false;
        this.errors.show(
          e?.error?.message ?? `Erro ao carregar faixas de ${grade.titulo}.`,
          'Comissões Comercial',
        );
      },
    });
  }

  private excluirFaixa(id: string, grade: FaixaGrade): void {
    this.service.excluirFaixa(id).subscribe({
      next: (lista) => {
        this.aplicarLista(grade, lista);
      },
      error: (e) => {
        this.errors.show(
          e?.error?.message ?? 'Erro ao excluir faixa.',
          'Comissões Comercial',
        );
      },
    });
  }

  private carregarPadrao(grade: FaixaGrade): void {
    if (!this.funcionarioId) return;
    grade.carregandoPadrao = true;
    this.service.carregarPadrao(this.funcionarioId, grade.tipoBase).subscribe({
      next: (lista) => {
        this.aplicarLista(grade, lista);
        grade.carregandoPadrao = false;
      },
      error: (e) => {
        grade.carregandoPadrao = false;
        this.errors.show(
          e?.error?.message ?? `Erro ao carregar faixas padrão de ${grade.titulo}.`,
          'Comissões Comercial',
        );
      },
    });
  }

  private carregarPendentes(): void {
    if (!this.unidadeFiltro) return;
    this.carregandoPendentes = true;
    this.service.carregarPadraoPendentes(this.unidadeFiltro).subscribe({
      next: (res) => {
        this.carregandoPendentes = false;
        this.carregarVendedores();
        if (this.funcionarioId) {
          this.carregarFaixas();
          this.carregarPolitica();
        }
        this.mensagemResultado =
          res.basesCarregadas === 0
            ? 'Nenhum vendedor pendente: todos já possuem faixas nas duas bases.'
            : `Faixas padrão carregadas em ${res.vendedoresAfetados} vendedor(es) (${res.basesCarregadas} base(s) preenchida(s)). Faixas já cadastradas foram mantidas.`;
      },
      error: (e) => {
        this.carregandoPendentes = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao carregar faixas pendentes.',
          'Comissões Comercial',
        );
      },
    });
  }

  private aplicarLista(grade: FaixaGrade, lista: ComercialComissaoFaixaItem[]): void {
    grade.linhas = lista.map((item) => this.paraLinha(item, grade.tipoBase));
    this.atualizarContagemFaixas(grade.tipoBase, lista.length);
  }

  private paraLinha(
    item: ComercialComissaoFaixaItem,
    tipoBase: ComercialTipoBase,
  ): FaixaRow {
    return {
      localId: item.id,
      id: item.id,
      tipoBase,
      percentualMetaDe: item.percentualMetaDe,
      percentualMetaAte: item.percentualMetaAte,
      percentualComissao: item.percentualComissao,
      valorBonus: Number(item.valorBonus ?? 0),
      draftDe: this.formatNumero(item.percentualMetaDe),
      draftAte: this.formatNumero(item.percentualMetaAte),
      draftComissao: this.formatNumero(item.percentualComissao),
      draftBonus: this.formatarMoedaInput(item.valorBonus ?? 0),
      editando: false,
      salvando: false,
    };
  }

  private rotuloFaixasPadrao(tipoBase: ComercialTipoBase): string {
    if (tipoBase === ComercialTipoBase.MARCA_PROPRIA) {
      return '0%, 1,5%, 2%, 2,5% e 3,5%';
    }
    return '0%, 1%, 1,25%, 1,35% e 2%';
  }

  private atualizarContagemFaixas(
    tipoBase: ComercialTipoBase,
    qtd: number,
  ): void {
    const atual = this.vendedores.find(
      (v) => v.funcionarioId === this.funcionarioId,
    );
    if (!atual) return;
    if (tipoBase === ComercialTipoBase.REQUISICAO) {
      atual.faixasRequisicaoCount = qtd;
    } else {
      atual.faixasMarcaPropriaCount = qtd;
    }
  }

  private limparGrades(): void {
    for (const grade of this.grades) {
      grade.linhas = [];
      grade.carregando = false;
      grade.carregandoPadrao = false;
      grade.incidencia = ComercialIncidenciaComissao.PROPRIAS;
      grade.percentualMinimoLoja = null;
      grade.draftIncidencia = ComercialIncidenciaComissao.PROPRIAS;
      grade.draftMinimoLoja = '';
      grade.politicaSalvando = false;
    }
  }

  private carregarPolitica(): void {
    const funcionarioId = this.funcionarioId;
    if (!funcionarioId || !this.podeLer()) return;
    this.service.listarPolitica(funcionarioId).subscribe({
      next: (res) => {
        if (this.funcionarioId !== funcionarioId) return;
        this.aplicarPolitica(res.itens);
      },
      error: (e) => {
        if (this.funcionarioId !== funcionarioId) return;
        this.errors.show(
          e?.error?.message ?? 'Erro ao carregar regra de cálculo.',
          'Comissões Comercial',
        );
      },
    });
  }

  salvarPolitica(grade: FaixaGrade): void {
    if (!this.podeEditarPolitica() || !this.funcionarioId || grade.politicaSalvando) {
      return;
    }
    const minimoTexto = grade.draftMinimoLoja.trim();
    const minimo =
      minimoTexto === '' ? null : this.parseNumero(minimoTexto);
    if (minimoTexto !== '' && minimo == null) {
      this.errors.show(
        'Informe um % mínimo da loja válido, ou deixe vazio para pagar sempre.',
        'Comissões Comercial',
      );
      return;
    }
    grade.politicaSalvando = true;
    this.service
      .salvarPolitica({
        funcionarioId: this.funcionarioId,
        tipoBase: grade.tipoBase,
        incidencia: grade.draftIncidencia,
        percentualMinimoLoja: minimo,
      })
      .subscribe({
        next: (res) => {
          this.aplicarPolitica(res.itens);
        },
        error: (e) => {
          grade.politicaSalvando = false;
          this.errors.show(
            e?.error?.message ?? 'Erro ao salvar regra de cálculo.',
            'Comissões Comercial',
          );
        },
      });
  }

  private aplicarPolitica(
    itens: Array<{
      tipoBase: ComercialTipoBase;
      incidencia: ComercialIncidenciaComissao;
      percentualMinimoLoja: number | null;
    }>,
  ): void {
    for (const grade of this.grades) {
      const item = itens.find((i) => i.tipoBase === grade.tipoBase);
      grade.incidencia =
        item?.incidencia ?? ComercialIncidenciaComissao.PROPRIAS;
      grade.percentualMinimoLoja = item?.percentualMinimoLoja ?? null;
      grade.draftIncidencia = grade.incidencia;
      grade.draftMinimoLoja =
        grade.percentualMinimoLoja == null
          ? ''
          : this.formatNumero(grade.percentualMinimoLoja);
      grade.politicaSalvando = false;
    }
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

  private readonly moedaFmt = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  private formatarMoedaInput(valor: number | null): string {
    if (valor == null || valor === 0) return '';
    return this.moedaFmt.format(valor);
  }

  private formatarMoedaDigitacao(texto: string): string {
    const digits = texto.replace(/\D/g, '');
    if (!digits) return '';
    const cents = Number.parseInt(digits, 10);
    if (!Number.isFinite(cents) || cents < 0) return '';
    return this.moedaFmt.format(cents / 100);
  }

  private parseValorMoeda(texto: string): number | null {
    const digits = texto.replace(/\D/g, '');
    if (!digits) return 0;
    const cents = Number.parseInt(digits, 10);
    if (!Number.isFinite(cents) || cents < 0) return null;
    return Math.round(cents) / 100;
  }
}
