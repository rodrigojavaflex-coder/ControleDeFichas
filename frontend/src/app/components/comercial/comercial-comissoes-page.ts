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
  codigosSetor: number[];
  codigosSetorRevendaManipulados: number[];
  draftIncidencia: ComercialIncidenciaComissao;
  draftMinimoLoja: string;
  draftCodigosSetor: string;
  draftCodigosSetorRevendaManipulados: string;
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
  readonly ComercialTipoBase = ComercialTipoBase;
  readonly grades: FaixaGrade[] = [
    {
      tipoBase: ComercialTipoBase.REQUISICAO,
      titulo: 'Manipulados',
      linhas: [],
      carregando: false,
      carregandoPadrao: false,
      incidencia: ComercialIncidenciaComissao.PROPRIAS,
      percentualMinimoLoja: null,
      codigosSetor: [],
      codigosSetorRevendaManipulados: [],
      draftIncidencia: ComercialIncidenciaComissao.PROPRIAS,
      draftMinimoLoja: '',
      draftCodigosSetor: '',
      draftCodigosSetorRevendaManipulados: '',
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
      codigosSetor: [],
      codigosSetorRevendaManipulados: [],
      draftIncidencia: ComercialIncidenciaComissao.PROPRIAS,
      draftMinimoLoja: '',
      draftCodigosSetor: '',
      draftCodigosSetorRevendaManipulados: '',
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
  draftCodigosSetorUnidade = '';
  draftCodigosSetorRevendaUnidade = '';
  codigosSetorUnidade: number[] = [];
  codigosSetorRevendaUnidade: number[] = [];
  carregandoPoliticaUnidade = false;
  politicaUnidadeSalvando = false;
  modalSetoresUnidadeAberto = false;
  modalAplicarSetoresAberto = false;
  modalPoliticaGrade: FaixaGrade | null = null;
  modalFaixaGrade: FaixaGrade | null = null;
  modalFaixaRow: FaixaRow | null = null;
  modalFaixasGrade: FaixaGrade | null = null;

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
      this.carregarPoliticaUnidade();
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
    return this.modalFaixaRow != null || this.grades.some((g) => g.linhas.some((r) => r.editando || r.salvando));
  }

  podeSalvarLinha(row: FaixaRow): boolean {
    return row.id ? this.podeEditarFaixa() : this.podeIncluirFaixa();
  }

  rotuloVendedor(v: ComercialComissaoVendedorItem): string {
    return `${v.nome} (${v.codigoVendedorErp})`;
  }

  rotuloVendedorSelecionado(): string {
    const atual = this.vendedores.find((v) => v.funcionarioId === this.funcionarioId);
    return atual ? this.rotuloVendedor(atual) : '';
  }

  onUnidadeChange(): void {
    this.funcionarioId = '';
    this.vendedores = [];
    this.limparGrades();
    this.mensagemResultado = '';
    this.codigosSetorUnidade = [];
    this.draftCodigosSetorUnidade = '';
    this.codigosSetorRevendaUnidade = [];
    this.draftCodigosSetorRevendaUnidade = '';
    this.modalSetoresUnidadeAberto = false;
    if (!this.unidadeFiltro) return;
    this.carregarVendedores();
    this.carregarPoliticaUnidade();
  }

  onVendedorChange(): void {
    this.limparGrades();
    if (!this.funcionarioId) return;
    this.carregarFaixas();
    this.carregarPolitica();
  }

  abrirModalFaixas(grade: FaixaGrade): void {
    this.fecharModalPolitica();
    if (this.modalSetoresUnidadeAberto) {
      this.fecharModalSetoresUnidade();
    }
    this.modalFaixasGrade = grade;
  }

  fecharModalFaixas(): void {
    if (this.modalFaixaRow?.salvando) return;
    this.modalFaixasGrade = null;
  }

  rotuloResumoFaixa(row: FaixaRow): string {
    const bonus =
      row.valorBonus && row.valorBonus > 0
        ? ` · bônus ${this.formatarBonus(row.valorBonus)}`
        : '';
    return `${this.formatarPercentual(row.percentualMetaDe)} a ${this.formatarPercentual(row.percentualMetaAte)} → ${this.formatarPercentual(row.percentualComissao)}${bonus}`;
  }

  incluirFaixaNaGrade(grade: FaixaGrade): void {
    if (!this.podeIncluirFaixa() || this.temLinhaEmEdicao()) return;
    this.fecharModalPolitica();
    if (this.modalSetoresUnidadeAberto) {
      this.fecharModalSetoresUnidade();
    }
    this.modalFaixaGrade = grade;
    this.modalFaixaRow = {
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
    };
  }

  alterarLinha(row: FaixaRow, grade: FaixaGrade): void {
    if (!this.podeEditarFaixa() || this.temLinhaEmEdicao()) return;
    this.fecharModalPolitica();
    if (this.modalSetoresUnidadeAberto) {
      this.fecharModalSetoresUnidade();
    }
    row.draftDe = this.formatNumero(row.percentualMetaDe);
    row.draftAte = this.formatNumero(row.percentualMetaAte);
    row.draftComissao = this.formatNumero(row.percentualComissao);
    row.draftBonus = this.formatarMoedaInput(row.valorBonus);
    row.salvando = false;
    this.modalFaixaGrade = grade;
    this.modalFaixaRow = row;
  }

  fecharModalFaixa(): void {
    if (this.modalFaixaRow?.salvando) return;
    this.modalFaixaGrade = null;
    this.modalFaixaRow = null;
  }

  rotuloModalFaixa(): string {
    const titulo = this.modalFaixaGrade?.titulo ?? 'faixa';
    return this.modalFaixaRow?.id ? `Alterar faixa — ${titulo}` : `Incluir faixa — ${titulo}`;
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
        const incluida = !row.id;
        this.aplicarLista(grade, lista);
        this.modalFaixaGrade = null;
        this.modalFaixaRow = null;
        this.mensagemResultado = incluida
          ? `Faixa incluída em ${grade.titulo}.`
          : `Faixa de ${grade.titulo} atualizada.`;
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

  formatarDraftBonusModal(): void {
    if (!this.modalFaixaRow) return;
    this.formatarDraftBonus(this.modalFaixaRow);
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
      grade.codigosSetor = [];
      grade.codigosSetorRevendaManipulados = [];
      grade.draftIncidencia = ComercialIncidenciaComissao.PROPRIAS;
      grade.draftMinimoLoja = '';
      grade.draftCodigosSetor = '';
      grade.draftCodigosSetorRevendaManipulados = '';
      grade.politicaSalvando = false;
    }
    this.modalPoliticaGrade = null;
    this.modalFaixaGrade = null;
    this.modalFaixaRow = null;
    this.modalFaixasGrade = null;
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

  abrirModalSetoresUnidade(): void {
    if (!this.unidadeFiltro) return;
    this.fecharModalPolitica();
    this.draftCodigosSetorUnidade = this.formatarCodigosSetor(
      this.codigosSetorUnidade,
    );
    this.draftCodigosSetorRevendaUnidade = this.formatarCodigosSetor(
      this.codigosSetorRevendaUnidade,
    );
    this.modalSetoresUnidadeAberto = true;
  }

  abrirModalPolitica(grade: FaixaGrade): void {
    if (this.modalSetoresUnidadeAberto) {
      this.fecharModalSetoresUnidade();
    }
    if (this.modalFaixasGrade && !this.modalFaixaRow?.salvando) {
      this.modalFaixasGrade = null;
    }
    this.restaurarDraftPolitica(grade);
    this.modalPoliticaGrade = grade;
  }

  fecharModalPolitica(): void {
    if (this.modalPoliticaGrade?.politicaSalvando) return;
    if (this.modalPoliticaGrade) {
      this.restaurarDraftPolitica(this.modalPoliticaGrade);
    }
    this.modalPoliticaGrade = null;
  }

  rotuloIncidencia(grade: FaixaGrade): string {
    return grade.incidencia === ComercialIncidenciaComissao.LOJA
      ? 'Vendas da loja'
      : 'Vendas próprias';
  }

  explicaIncidencia(grade: FaixaGrade): string {
    return grade.incidencia === ComercialIncidenciaComissao.LOJA
      ? 'Os cálculos das comissões são sobre o total da unidade.'
      : 'Os cálculos das comissões são sobre as vendas do(a) vendedor(a).';
  }

  rotuloTrava(grade: FaixaGrade): string {
    if (grade.percentualMinimoLoja == null) {
      return 'Paga sempre';
    }
    return `Só se a loja atingir ${this.formatarPercentual(grade.percentualMinimoLoja)}`;
  }

  explicaTrava(grade: FaixaGrade): string {
    if (grade.percentualMinimoLoja == null) {
      return 'Recebe mesmo que a loja não tenha batido a meta.';
    }
    return 'Se a loja não atingir esse % da meta, zera comissão e bônus.';
  }

  rotuloSetoresPolitica(grade: FaixaGrade): string {
    if (grade.tipoBase === ComercialTipoBase.REQUISICAO) {
      const codigos = grade.codigosSetorRevendaManipulados;
      if (!codigos.length) {
        return 'Só requisições';
      }
      return `Vendas do(s) setor(es) ${this.formatarCodigosSetor(codigos)} somam em Manipulados`;
    }
    const codigos = grade.codigosSetor;
    if (!codigos.length) {
      return 'Todos os produtos de revenda';
    }
    return `Vendas do(s) setor(es) ${this.formatarCodigosSetor(codigos)}`;
  }

  explicaSetoresPolitica(grade: FaixaGrade): string {
    if (grade.tipoBase === ComercialTipoBase.REQUISICAO) {
      if (!grade.codigosSetorRevendaManipulados.length) {
        return 'Nenhum setor de marca própria é contabilizado como manipulado.';
      }
      return 'Produtos desses setores de marca própria entram no Manipulados deste vendedor.';
    }
    if (!grade.codigosSetor.length) {
      return 'Não há recorte: qualquer setor de revenda entra na marca própria deste vendedor.';
    }
    return 'Só esses setores entram no total de marca própria deste vendedor.';
  }

  rotuloSetoresUnidadeMp(): string {
    if (!this.codigosSetorUnidade.length) {
      return 'Todos os produtos de revenda';
    }
    return `Vendas do(s) setor(es) ${this.formatarCodigosSetor(this.codigosSetorUnidade)}`;
  }

  explicaSetoresUnidadeMp(): string {
    if (!this.codigosSetorUnidade.length) {
      return 'O TOTAL de marca própria da unidade soma qualquer setor de revenda.';
    }
    return 'O TOTAL de marca própria da unidade soma só esses setores.';
  }

  rotuloSetoresUnidadeManip(): string {
    if (!this.codigosSetorRevendaUnidade.length) {
      return 'Só requisições';
    }
    return `Vendas do(s) setor(es) ${this.formatarCodigosSetor(this.codigosSetorRevendaUnidade)} somam em Manipulados`;
  }

  explicaSetoresUnidadeManip(): string {
    if (!this.codigosSetorRevendaUnidade.length) {
      return 'Nenhum setor de marca própria é contabilizado como manipulado no TOTAL.';
    }
    return 'Produtos desses setores de marca própria entram no Manipulados do TOTAL.';
  }

  private restaurarDraftPolitica(grade: FaixaGrade): void {
    grade.draftIncidencia = grade.incidencia;
    grade.draftMinimoLoja =
      grade.percentualMinimoLoja == null
        ? ''
        : this.formatNumero(grade.percentualMinimoLoja);
    grade.draftCodigosSetor = this.formatarCodigosSetor(grade.codigosSetor);
    grade.draftCodigosSetorRevendaManipulados = this.formatarCodigosSetor(
      grade.codigosSetorRevendaManipulados,
    );
  }

  fecharModalSetoresUnidade(): void {
    if (this.politicaUnidadeSalvando) return;
    this.modalAplicarSetoresAberto = false;
    this.draftCodigosSetorUnidade = this.formatarCodigosSetor(
      this.codigosSetorUnidade,
    );
    this.draftCodigosSetorRevendaUnidade = this.formatarCodigosSetor(
      this.codigosSetorRevendaUnidade,
    );
    this.modalSetoresUnidadeAberto = false;
  }

  pedirAplicarSetoresAosVendedores(): void {
    if (
      !this.podeEditarPolitica() ||
      !this.unidadeFiltro ||
      this.politicaUnidadeSalvando
    ) {
      return;
    }
    if (this.obterDraftSetoresUnidade() == null) {
      this.errors.show(
        'Informe códigos de setor numéricos separados por vírgula (ex.: 276, 330), ou deixe vazio.',
        'Comissões Comercial',
      );
      return;
    }
    this.modalAplicarSetoresAberto = true;
  }

  fecharAplicarSetores(): void {
    if (this.politicaUnidadeSalvando) return;
    this.modalAplicarSetoresAberto = false;
  }

  confirmarAplicarSetores(somenteSemConfiguracao: boolean): void {
    this.aplicarSetoresAosVendedores(somenteSemConfiguracao);
  }

  private carregarPoliticaUnidade(): void {
    const unidade = this.unidadeFiltro;
    if (!unidade || !this.podeLer()) return;
    this.carregandoPoliticaUnidade = true;
    this.service.listarPoliticaUnidade(unidade).subscribe({
      next: (res) => {
        if (this.unidadeFiltro !== unidade) return;
        this.carregandoPoliticaUnidade = false;
        this.codigosSetorUnidade = res.codigosSetor ?? [];
        this.draftCodigosSetorUnidade = this.formatarCodigosSetor(
          this.codigosSetorUnidade,
        );
        this.codigosSetorRevendaUnidade =
          res.codigosSetorRevendaManipulados ?? [];
        this.draftCodigosSetorRevendaUnidade = this.formatarCodigosSetor(
          this.codigosSetorRevendaUnidade,
        );
      },
      error: (e) => {
        if (this.unidadeFiltro !== unidade) return;
        this.carregandoPoliticaUnidade = false;
        this.errors.show(
          e?.error?.message ?? 'Erro ao carregar setores da unidade.',
          'Comissões Comercial',
        );
      },
    });
  }

  salvarPoliticaUnidade(): void {
    if (
      !this.podeEditarPolitica() ||
      !this.unidadeFiltro ||
      this.politicaUnidadeSalvando
    ) {
      return;
    }
    const draft = this.obterDraftSetoresUnidade();
    if (!draft) {
      this.errors.show(
        'Informe códigos de setor numéricos separados por vírgula (ex.: 276, 330), ou deixe vazio.',
        'Comissões Comercial',
      );
      return;
    }
    this.politicaUnidadeSalvando = true;
    this.service
      .salvarPoliticaUnidade({
        unidade: this.unidadeFiltro,
        codigosSetor: draft.codigosSetor,
        codigosSetorRevendaManipulados: draft.codigosSetorRevendaManipulados,
      })
      .subscribe({
        next: (res) => {
          this.politicaUnidadeSalvando = false;
          this.codigosSetorUnidade = res.codigosSetor ?? [];
          this.draftCodigosSetorUnidade = this.formatarCodigosSetor(
            this.codigosSetorUnidade,
          );
          this.codigosSetorRevendaUnidade =
            res.codigosSetorRevendaManipulados ?? [];
          this.draftCodigosSetorRevendaUnidade = this.formatarCodigosSetor(
            this.codigosSetorRevendaUnidade,
          );
          this.mensagemResultado = 'Setores da unidade salvos.';
          this.modalSetoresUnidadeAberto = false;
        },
        error: (e) => {
          this.politicaUnidadeSalvando = false;
          this.errors.show(
            e?.error?.message ?? 'Erro ao salvar setores da unidade.',
            'Comissões Comercial',
          );
        },
      });
  }

  private obterDraftSetoresUnidade(): {
    codigosSetor: number[];
    codigosSetorRevendaManipulados: number[];
  } | null {
    const parsed = this.parseCodigosSetor(this.draftCodigosSetorUnidade);
    const parsedRevenda = this.parseCodigosSetor(
      this.draftCodigosSetorRevendaUnidade,
    );
    if (parsed == null || parsedRevenda == null) {
      return null;
    }
    return {
      codigosSetor: parsed,
      codigosSetorRevendaManipulados: parsedRevenda,
    };
  }

  private aplicarSetoresAosVendedores(somenteSemConfiguracao: boolean): void {
    const unidade = this.unidadeFiltro;
    const draft = this.obterDraftSetoresUnidade();
    if (!this.podeEditarPolitica() || !unidade || !draft) {
      return;
    }
    this.politicaUnidadeSalvando = true;
    this.service
      .aplicarPoliticaUnidadeAosVendedores({
        unidade,
        somenteSemConfiguracao,
        codigosSetor: draft.codigosSetor,
        codigosSetorRevendaManipulados: draft.codigosSetorRevendaManipulados,
      })
      .subscribe({
        next: (res) => {
          this.politicaUnidadeSalvando = false;
          this.codigosSetorUnidade = draft.codigosSetor;
          this.draftCodigosSetorUnidade = this.formatarCodigosSetor(
            this.codigosSetorUnidade,
          );
          this.codigosSetorRevendaUnidade = draft.codigosSetorRevendaManipulados;
          this.draftCodigosSetorRevendaUnidade = this.formatarCodigosSetor(
            this.codigosSetorRevendaUnidade,
          );
          const alcance = res.somenteSemConfiguracao
            ? 'somente vendedores sem lista'
            : 'todos os vendedores';
          this.mensagemResultado =
            res.vendedoresAfetados > 0
              ? `Setores da unidade gravados e aplicados a ${res.vendedoresAfetados} vendedor(es) (${alcance}).`
              : `Setores da unidade gravados. Nenhum vendedor precisava de atualização (${alcance}).`;
          this.modalAplicarSetoresAberto = false;
          this.modalSetoresUnidadeAberto = false;
          if (this.funcionarioId) {
            this.carregarPolitica();
          }
        },
        error: (e) => {
          this.politicaUnidadeSalvando = false;
          this.errors.show(
            e?.error?.message ??
              'Erro ao aplicar os setores da unidade aos vendedores.',
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
    let codigosSetor: number[] = [];
    let codigosSetorRevendaManipulados: number[] = [];
    if (grade.tipoBase === ComercialTipoBase.MARCA_PROPRIA) {
      const parsed = this.parseCodigosSetor(grade.draftCodigosSetor);
      if (parsed == null) {
        this.errors.show(
          'Informe códigos de setor numéricos separados por vírgula (ex.: 276, 330), ou deixe vazio para todos os produtos.',
          'Comissões Comercial',
        );
        return;
      }
      codigosSetor = parsed;
    }
    if (grade.tipoBase === ComercialTipoBase.REQUISICAO) {
      const parsedRev = this.parseCodigosSetor(
        grade.draftCodigosSetorRevendaManipulados,
      );
      if (parsedRev == null) {
        this.errors.show(
          'Informe códigos de setor numéricos separados por vírgula (ex.: 400), ou deixe vazio para não somar revenda em Manipulados.',
          'Comissões Comercial',
        );
        return;
      }
      codigosSetorRevendaManipulados = parsedRev;
    }
    grade.politicaSalvando = true;
    this.service
      .salvarPolitica({
        funcionarioId: this.funcionarioId,
        tipoBase: grade.tipoBase,
        incidencia: grade.draftIncidencia,
        percentualMinimoLoja: minimo,
        ...(grade.tipoBase === ComercialTipoBase.MARCA_PROPRIA
          ? { codigosSetor }
          : { codigosSetorRevendaManipulados }),
      })
      .subscribe({
        next: (res) => {
          this.aplicarPolitica(res.itens);
          this.modalPoliticaGrade = null;
          this.mensagemResultado = `Regra de ${grade.titulo} salva.`;
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
      codigosSetor?: number[];
      codigosSetorRevendaManipulados?: number[];
    }>,
  ): void {
    for (const grade of this.grades) {
      const item = itens.find((i) => i.tipoBase === grade.tipoBase);
      grade.incidencia =
        item?.incidencia ?? ComercialIncidenciaComissao.PROPRIAS;
      grade.percentualMinimoLoja = item?.percentualMinimoLoja ?? null;
      grade.codigosSetor = item?.codigosSetor ?? [];
      grade.codigosSetorRevendaManipulados =
        item?.codigosSetorRevendaManipulados ?? [];
      grade.draftIncidencia = grade.incidencia;
      grade.draftMinimoLoja =
        grade.percentualMinimoLoja == null
          ? ''
          : this.formatNumero(grade.percentualMinimoLoja);
      grade.draftCodigosSetor = this.formatarCodigosSetor(grade.codigosSetor);
      grade.draftCodigosSetorRevendaManipulados = this.formatarCodigosSetor(
        grade.codigosSetorRevendaManipulados,
      );
      grade.politicaSalvando = false;
    }
  }

  private parseCodigosSetor(texto: string): number[] | null {
    const bruto = texto.trim();
    if (!bruto) {
      return [];
    }
    const partes = bruto.split(/[,;/\s]+/).filter((p) => p.length > 0);
    const unicos = new Set<number>();
    for (const parte of partes) {
      if (!/^\d+$/.test(parte)) {
        return null;
      }
      const n = Number(parte);
      if (!Number.isInteger(n) || n <= 0) {
        return null;
      }
      unicos.add(n);
    }
    return [...unicos].sort((a, b) => a - b);
  }

  private formatarCodigosSetor(codigos: number[]): string {
    return (codigos ?? []).join(', ');
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
