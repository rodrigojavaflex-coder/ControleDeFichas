import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  finalize,
  switchMap,
} from 'rxjs/operators';
import ExcelJS from 'exceljs';
import { AuthService } from '../../services/auth.service';
import { PageContextService } from '../../services/page-context.service';
import { VisitacaoAnaliseService } from '../../services/visitacao-analise.service';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  VisitacaoAnaliseCompetencia,
  VisitacaoAnaliseMedico,
  VisitacaoAnaliseModo,
  VisitacaoAnaliseNaCarteira,
  VisitacaoAnaliseResponse,
} from '../../models/visitacao-analise.model';
import { VisitacaoPainelMedicoRepresentante } from '../../models/visitacao-painel-medico.model';
import {
  MultiSelectDropdownComponent,
  MultiSelectOption,
} from '../multi-select-dropdown/multi-select-dropdown';

type ExportCard =
  | 'crescimento'
  | 'queda'
  | 'rejeitados'
  | 'vendas'
  | 'rejeitadosRanking';

type SortField =
  | 'nome'
  | 'valorMes1'
  | 'valorMes2'
  | 'valorPeriodo'
  | 'valorMedia'
  | 'delta'
  | 'percentual';
type SortDir = 'asc' | 'desc';
type FaixaCresc = 'faixa-cresc-1' | 'faixa-cresc-2' | 'faixa-cresc-3' | 'faixa-cresc-4';
type FaixaQueda = 'faixa-queda-1' | 'faixa-queda-2' | 'faixa-queda-3' | 'faixa-queda-4';
type FaixaAbs =
  | 'faixa-abs-1'
  | 'faixa-abs-2'
  | 'faixa-abs-3'
  | 'faixa-abs-4';

@Component({
  selector: 'app-visitacao-analise-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MultiSelectDropdownComponent],
  templateUrl: './visitacao-analise-page.html',
  styleUrls: [
    '../vendas-list/vendas-list.css',
    './visitacao-analise-page.css',
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisitacaoAnalisePageComponent implements OnInit, OnDestroy {
  private service = inject(VisitacaoAnaliseService);
  private authService = inject(AuthService);
  private pageContextService = inject(PageContextService);
  private cdr = inject(ChangeDetectorRef);

  loading = false;
  loadingOpcoes = false;
  error = '';
  dados: VisitacaoAnaliseResponse | null = null;

  unidadeFilter: Unidade | '' = '';
  unidades = Object.values(Unidade);
  unidadeDisabled = false;

  modo: VisitacaoAnaliseModo = 'comparar';
  /** Todas as competências fechadas da unidade (todos os anos). */
  competenciasDisponiveis: VisitacaoAnaliseCompetencia[] = [];
  /** Anos selecionados no filtro (multi-check); padrão = ano corrente. */
  anosFiltro: number[] = [];
  c1: string | null = null;
  c2: string | null = null;
  competenciasRanking: string[] = [];

  representantes: VisitacaoPainelMedicoRepresentante[] = [];
  funcionarioIdFilter = '';
  nomeMedicoFilter = '';
  naCarteiraFilter: VisitacaoAnaliseNaCarteira = 'todos';

  filtroFaixaCresc: FaixaCresc | null = null;
  filtroFaixaQueda: FaixaQueda | null = null;
  filtroFaixaRej: FaixaAbs | null = null;

  sortCrescField: SortField = 'delta';
  sortCrescDir: SortDir = 'desc';
  sortQuedaField: SortField = 'delta';
  sortQuedaDir: SortDir = 'asc';
  sortRejField: SortField = 'valorMes2';
  sortRejDir: SortDir = 'desc';
  sortVendasField: SortField = 'valorPeriodo';
  sortVendasDir: SortDir = 'desc';
  sortRejRankField: SortField = 'valorPeriodo';
  sortRejRankDir: SortDir = 'desc';

  private reload$ = new Subject<void>();
  private reloadSub?: Subscription;
  private opcoesSub?: Subscription;
  /** Evita disparar análise ao setar competências padrão no bootstrap. */
  private silenciarFiltroChange = false;

  private readonly moedaFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  private readonly percentualFormatter = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  ngOnInit(): void {
    if (!this.canRead()) {
      this.error =
        'Você não possui permissão para visualizar a análise de visitação.';
      return;
    }

    const user = this.authService.getCurrentUser();
    if (user?.unidade?.trim()) {
      this.unidadeFilter = user.unidade as Unidade;
      this.unidadeDisabled = true;
    }

    this.atualizarPageContext();

    this.reloadSub = this.reload$
      .pipe(
        debounceTime(80),
        switchMap(() => {
          if (!this.podeAnalisar()) {
            this.dados = null;
            this.loading = false;
            this.cdr.markForCheck();
            return of(null);
          }
          this.loading = true;
          this.error = '';
          this.cdr.markForCheck();
          return this.service.analisar(this.montarFiltrosAnalise()).pipe(
            catchError((err) => {
              this.error =
                err?.error?.message ||
                err?.message ||
                'Falha ao carregar a análise de visitação.';
              this.dados = null;
              return of(null);
            }),
            finalize(() => {
              this.loading = false;
              this.cdr.markForCheck();
            }),
          );
        }),
      )
      .subscribe((res) => {
        this.dados = res;
        this.resetFiltrosFaixa();
        this.cdr.markForCheck();
      });

    if (this.unidadeFilter) {
      this.carregarOpcoes(true);
    }
  }

  ngOnDestroy(): void {
    this.reloadSub?.unsubscribe();
    this.opcoesSub?.unsubscribe();
  }

  canRead(): boolean {
    return this.authService.hasPermission(Permission.VISITACAO_ANALISE_READ);
  }

  get isComparar(): boolean {
    return this.modo === 'comparar';
  }

  get isRanking(): boolean {
    return this.modo === 'ranking';
  }

  get anosOptions(): MultiSelectOption[] {
    const anos = [
      ...new Set(this.competenciasDisponiveis.map((c) => c.ano)),
    ].sort((a, b) => b - a);
    return anos.map((ano) => ({ value: ano, label: String(ano) }));
  }

  /** Competências visíveis conforme anos marcados. */
  get competenciasFiltradas(): VisitacaoAnaliseCompetencia[] {
    if (!this.anosFiltro.length) {
      return [];
    }
    const anos = new Set(this.anosFiltro.map(Number));
    return this.competenciasDisponiveis.filter((c) => anos.has(c.ano));
  }

  get competenciasOptions(): MultiSelectOption[] {
    return this.competenciasFiltradas.map((c) => ({
      value: c.key,
      label: c.label,
    }));
  }

  /** Cabeçalhos das grades (abreviado p/ caber sem scroll): Ago/2026, Set/2026. */
  get labelCompetencia1(): string {
    return this.labelCompetenciaAbreviada(this.dados?.competencia1) ?? 'Comp. 1';
  }

  get labelCompetencia2(): string {
    return this.labelCompetenciaAbreviada(this.dados?.competencia2) ?? 'Comp. 2';
  }

  private static readonly MESES_ABREV = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ] as const;

  private labelCompetenciaAbreviada(
    c: { mes: number; ano: number; label?: string } | null | undefined,
  ): string | null {
    if (!c?.mes || !c?.ano) {
      return null;
    }
    const abrev =
      VisitacaoAnalisePageComponent.MESES_ABREV[c.mes - 1] ?? String(c.mes);
    return `${abrev}/${c.ano}`;
  }

  get crescimentoVisivel(): VisitacaoAnaliseMedico[] {
    if (!this.dados) return [];
    let list = this.dados.crescimento;
    if (this.filtroFaixaCresc) {
      list = list.filter(
        (item) => this.faixaDelta(item.delta) === this.filtroFaixaCresc,
      );
    }
    return this.ordenarLista(list, this.sortCrescField, this.sortCrescDir);
  }

  get quedaVisivel(): VisitacaoAnaliseMedico[] {
    if (!this.dados) return [];
    let list = this.dados.queda;
    if (this.filtroFaixaQueda) {
      list = list.filter(
        (item) => this.faixaDelta(item.delta) === this.filtroFaixaQueda,
      );
    }
    return this.ordenarLista(list, this.sortQuedaField, this.sortQuedaDir);
  }

  get rejeitadosVisivel(): VisitacaoAnaliseMedico[] {
    if (!this.dados) return [];
    let list = this.dados.maioresRejeitados;
    if (this.filtroFaixaRej) {
      list = list.filter(
        (item) => this.faixaAbsDelta(item.delta) === this.filtroFaixaRej,
      );
    }
    return this.ordenarLista(list, this.sortRejField, this.sortRejDir);
  }

  get vendasVisivel(): VisitacaoAnaliseMedico[] {
    if (!this.dados) return [];
    return this.ordenarLista(
      this.dados.maioresVendas ?? [],
      this.sortVendasField,
      this.sortVendasDir,
    );
  }

  get rejeitadosRankingVisivel(): VisitacaoAnaliseMedico[] {
    if (!this.dados) return [];
    return this.ordenarLista(
      this.dados.maioresRejeitados ?? [],
      this.sortRejRankField,
      this.sortRejRankDir,
    );
  }

  get podeAtualizar(): boolean {
    return this.podeAnalisar() && !this.loadingOpcoes;
  }

  onUnidadeChange(): void {
    this.c1 = null;
    this.c2 = null;
    this.competenciasRanking = [];
    this.anosFiltro = [];
    this.funcionarioIdFilter = '';
    this.dados = null;
    this.carregarOpcoes(true);
  }

  onAnosChange(values: number[]): void {
    this.anosFiltro = [...values]
      .map(Number)
      .filter((n) => Number.isInteger(n))
      .sort((a, b) => b - a);
    this.silenciarFiltroChange = true;
    try {
      this.podarSelecaoCompetencias();
      if (this.isComparar) {
        this.aplicarSelecaoPadraoCompararSeVazio();
      } else {
        this.aplicarSelecaoPadraoRankingSeVazio();
      }
    } finally {
      this.silenciarFiltroChange = false;
    }
    this.onFiltroChange();
  }

  onModoChange(): void {
    this.dados = null;
    this.resetFiltrosFaixa();
    this.atualizarPageContext();
    this.silenciarFiltroChange = true;
    try {
      if (this.modo === 'ranking') {
        this.aplicarSelecaoPadraoRankingSeVazio();
      } else {
        this.aplicarSelecaoPadraoCompararSeVazio();
      }
    } finally {
      this.silenciarFiltroChange = false;
    }
    this.onFiltroChange();
  }

  onCompetenciasRankingChange(values: string[]): void {
    this.competenciasRanking = this.ordenarKeys([...values]);
    this.onFiltroChange();
  }

  /** Busca automática ao mudar filtro (como antes). */
  onFiltroChange(): void {
    if (this.silenciarFiltroChange || this.loadingOpcoes) {
      return;
    }
    this.reload$.next();
  }

  /** Refaz a busca com os filtros atuais. */
  atualizarAnalise(): void {
    if (!this.podeAnalisar() || this.loading || this.loadingOpcoes) {
      return;
    }
    this.reload$.next();
  }

  limparFaixaCresc(): void {
    this.filtroFaixaCresc = null;
    this.cdr.markForCheck();
  }

  limparFaixaQueda(): void {
    this.filtroFaixaQueda = null;
    this.cdr.markForCheck();
  }

  limparFaixaRej(): void {
    this.filtroFaixaRej = null;
    this.cdr.markForCheck();
  }

  toggleFaixaCresc(faixa: FaixaCresc): void {
    this.filtroFaixaCresc = this.filtroFaixaCresc === faixa ? null : faixa;
    this.cdr.markForCheck();
  }

  toggleFaixaQueda(faixa: FaixaQueda): void {
    this.filtroFaixaQueda = this.filtroFaixaQueda === faixa ? null : faixa;
    this.cdr.markForCheck();
  }

  toggleFaixaRej(faixa: FaixaAbs): void {
    this.filtroFaixaRej = this.filtroFaixaRej === faixa ? null : faixa;
    this.cdr.markForCheck();
  }

  onSortCresc(field: SortField): void {
    if (this.sortCrescField === field) {
      this.sortCrescDir = this.sortCrescDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortCrescField = field;
      this.sortCrescDir = field === 'nome' ? 'asc' : 'desc';
    }
    this.cdr.markForCheck();
  }

  onSortQueda(field: SortField): void {
    if (this.sortQuedaField === field) {
      this.sortQuedaDir = this.sortQuedaDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortQuedaField = field;
      this.sortQuedaDir = field === 'nome' ? 'asc' : 'asc';
    }
    this.cdr.markForCheck();
  }

  onSortRej(field: SortField): void {
    if (this.sortRejField === field) {
      this.sortRejDir = this.sortRejDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortRejField = field;
      this.sortRejDir = field === 'nome' ? 'asc' : 'desc';
    }
    this.cdr.markForCheck();
  }

  onSortVendas(field: SortField): void {
    if (this.sortVendasField === field) {
      this.sortVendasDir = this.sortVendasDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortVendasField = field;
      this.sortVendasDir = field === 'nome' ? 'asc' : 'desc';
    }
    this.cdr.markForCheck();
  }

  onSortRejRank(field: SortField): void {
    if (this.sortRejRankField === field) {
      this.sortRejRankDir = this.sortRejRankDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortRejRankField = field;
      this.sortRejRankDir = field === 'nome' ? 'asc' : 'desc';
    }
    this.cdr.markForCheck();
  }

  formatarValor(v: number | null | undefined): string {
    if (v == null) {
      return '—';
    }
    return this.moedaFormatter.format(v);
  }

  formatarDelta(v: number): string {
    const sinal = v > 0 ? '+' : '';
    return `${sinal}${this.moedaFormatter.format(v)}`;
  }

  formatarPercentual(v: number | null | undefined): string {
    if (v == null) {
      return '—';
    }
    const sinal = v > 0 ? '+' : '';
    return `${sinal}${this.percentualFormatter.format(v)}%`;
  }

  faixaDelta(delta: number): string {
    const abs = Math.abs(delta);
    if (delta > 0) {
      if (abs > 500) return 'faixa-cresc-4';
      if (abs > 100) return 'faixa-cresc-3';
      if (abs > 50) return 'faixa-cresc-2';
      if (abs >= 10) return 'faixa-cresc-1';
      return '';
    }
    if (delta < 0) {
      if (abs > 500) return 'faixa-queda-4';
      if (abs > 100) return 'faixa-queda-3';
      if (abs > 50) return 'faixa-queda-2';
      if (abs >= 10) return 'faixa-queda-1';
      return '';
    }
    return '';
  }

  faixaDeltaRejeitado(delta: number): string {
    const abs = Math.abs(delta);
    if (delta < 0) {
      if (abs > 500) return 'faixa-cresc-4';
      if (abs > 100) return 'faixa-cresc-3';
      if (abs > 50) return 'faixa-cresc-2';
      if (abs >= 10) return 'faixa-cresc-1';
      return '';
    }
    if (delta > 0) {
      if (abs > 500) return 'faixa-queda-4';
      if (abs > 100) return 'faixa-queda-3';
      if (abs > 50) return 'faixa-queda-2';
      if (abs >= 10) return 'faixa-queda-1';
      return '';
    }
    return '';
  }

  faixaAbsDelta(delta: number): FaixaAbs | '' {
    const abs = Math.abs(delta);
    if (abs > 500) return 'faixa-abs-4';
    if (abs > 100) return 'faixa-abs-3';
    if (abs > 50) return 'faixa-abs-2';
    if (abs >= 10) return 'faixa-abs-1';
    return '';
  }

  trackByMedico(_: number, item: VisitacaoAnaliseMedico): string {
    return `${item.crmMedico}|${item.ufCrmMedico}`;
  }

  async exportarExcel(card: ExportCard): Promise<void> {
    if (!this.dados) {
      return;
    }

    if (card === 'vendas' || card === 'rejeitadosRanking') {
      await this.exportarExcelRanking(card);
      return;
    }

    const c1Label = this.labelCompetencia1;
    const c2Label = this.labelCompetencia2;
    let lista: VisitacaoAnaliseMedico[] = [];
    let titulo = '';
    let colDelta = 'Diferença';
    let nomeArquivo = '';

    switch (card) {
      case 'crescimento':
        lista = this.crescimentoVisivel;
        titulo = 'Maior crescimento';
        colDelta = 'Aumento';
        nomeArquivo = 'visitacao_analise_crescimento';
        break;
      case 'queda':
        lista = this.quedaVisivel;
        titulo = 'Maior queda';
        colDelta = 'Queda';
        nomeArquivo = 'visitacao_analise_queda';
        break;
      case 'rejeitados':
        lista = this.rejeitadosVisivel;
        titulo = 'Rejeitados';
        colDelta = 'Diferença';
        nomeArquivo = 'visitacao_analise_rejeitados';
        break;
    }

    if (!lista.length) {
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(titulo.slice(0, 31));
    sheet.columns = [
      { header: 'Nome do médico', key: 'nome', width: 40 },
      { header: 'CRM', key: 'crm', width: 12 },
      { header: 'UF', key: 'uf', width: 6 },
      { header: 'Representante', key: 'rep', width: 32 },
      { header: c1Label, key: 'mes1', width: 16 },
      { header: c2Label, key: 'mes2', width: 16 },
      { header: colDelta, key: 'delta', width: 14 },
      { header: '%', key: 'pct', width: 12 },
    ];

    for (const item of lista) {
      sheet.addRow({
        nome: item.nomeMedico,
        crm: item.crmMedico,
        uf: item.ufCrmMedico,
        rep: item.nomeRepresentante ?? '',
        mes1: item.valorMes1,
        mes2: item.valorMes2,
        delta: item.delta,
        pct: item.percentual,
      });
    }

    sheet.getRow(1).font = { bold: true };
    const k1 = this.dados.competencia1?.key ?? 'c1';
    const k2 = this.dados.competencia2?.key ?? 'c2';
    await this.baixarWorkbook(
      workbook,
      `${nomeArquivo}_${this.dados.unidade}_${k1}_${k2}`,
    );
  }

  private async exportarExcelRanking(
    card: 'vendas' | 'rejeitadosRanking',
  ): Promise<void> {
    if (!this.dados) return;

    const lista =
      card === 'vendas' ? this.vendasVisivel : this.rejeitadosRankingVisivel;
    const titulo = card === 'vendas' ? 'Maiores vendas' : 'Mais rejeitados';
    const nomeArquivo =
      card === 'vendas'
        ? 'visitacao_analise_maiores_vendas'
        : 'visitacao_analise_mais_rejeitados';

    if (!lista.length) return;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(titulo.slice(0, 31));
    sheet.columns = [
      { header: 'Nome do médico', key: 'nome', width: 40 },
      { header: 'CRM', key: 'crm', width: 12 },
      { header: 'UF', key: 'uf', width: 6 },
      { header: 'Representante', key: 'rep', width: 32 },
      { header: 'Total', key: 'total', width: 14 },
      { header: 'Média', key: 'media', width: 14 },
    ];

    for (const item of lista) {
      sheet.addRow({
        nome: item.nomeMedico,
        crm: item.crmMedico,
        uf: item.ufCrmMedico,
        rep: item.nomeRepresentante ?? '',
        total: item.valorPeriodo,
        media: item.valorMedia,
      });
    }

    sheet.getRow(1).font = { bold: true };
    const slug = (this.dados.competencias ?? []).map((c) => c.key).join('_');
    await this.baixarWorkbook(
      workbook,
      `${nomeArquivo}_${this.dados.unidade}_${slug}`,
    );
  }

  private async baixarWorkbook(
    workbook: ExcelJS.Workbook,
    baseName: string,
  ): Promise<void> {
    const stamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:T]/g, '-');
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName}_${stamp}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private ordenarLista(
    list: VisitacaoAnaliseMedico[],
    field: SortField,
    dir: SortDir,
  ): VisitacaoAnaliseMedico[] {
    const fator = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const va = this.valorSort(a, field);
      const vb = this.valorSort(b, field);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string' && typeof vb === 'string') {
        return va.localeCompare(vb, 'pt-BR') * fator;
      }
      return ((va as number) - (vb as number)) * fator;
    });
  }

  private valorSort(
    item: VisitacaoAnaliseMedico,
    field: SortField,
  ): string | number | null {
    switch (field) {
      case 'nome':
        return item.nomeMedico ?? '';
      case 'valorMes1':
        return item.valorMes1;
      case 'valorMes2':
        return item.valorMes2;
      case 'valorPeriodo':
        return item.valorPeriodo;
      case 'valorMedia':
        return item.valorMedia;
      case 'delta':
        return item.delta;
      case 'percentual':
        return item.percentual;
      default:
        return null;
    }
  }

  private podeAnalisar(): boolean {
    if (!this.unidadeFilter) return false;
    if (this.modo === 'ranking') {
      return this.competenciasRanking.length > 0;
    }
    return !!this.c1 && !!this.c2 && this.c1 !== this.c2;
  }

  private montarFiltrosAnalise() {
    const base = {
      unidade: this.unidadeFilter as Unidade,
      funcionarioId: this.funcionarioIdFilter || undefined,
      nomeMedico: this.nomeMedicoFilter || undefined,
      naCarteira: this.naCarteiraFilter,
    };
    if (this.modo === 'ranking') {
      return {
        ...base,
        modo: 'ranking' as const,
        competencias: [...this.competenciasRanking],
      };
    }
    return {
      ...base,
      modo: 'comparar' as const,
      c1: this.c1!,
      c2: this.c2!,
    };
  }

  private resetFiltrosFaixa(): void {
    this.filtroFaixaCresc = null;
    this.filtroFaixaQueda = null;
    this.filtroFaixaRej = null;
  }

  private atualizarPageContext(): void {
    this.pageContextService.setContext({
      title: 'Análise de Visitação',
      description:
        this.modo === 'ranking'
          ? 'Ranking de valor total e rejeitados no período (competências fechadas, qualquer ano).'
          : 'Evolução do valor total e dos rejeitados entre duas competências fechadas (podem ser de anos diferentes).',
    });
  }

  private carregarOpcoes(selecionarPadrao: boolean): void {
    if (!this.unidadeFilter) {
      this.competenciasDisponiveis = [];
      this.representantes = [];
      this.loadingOpcoes = false;
      this.cdr.markForCheck();
      return;
    }
    // Opções leves primeiro; depois dispara a análise (busca automática).
    this.loadingOpcoes = true;
    this.opcoesSub?.unsubscribe();
    this.opcoesSub = this.service
      .opcoes({
        unidade: this.unidadeFilter as Unidade,
        comAnalise: false,
      })
      .pipe(
        catchError((err) => {
          this.error =
            err?.error?.message ||
            err?.message ||
            'Falha ao carregar opções da análise.';
          this.competenciasDisponiveis = [];
          this.representantes = [];
          this.anosFiltro = [];
          this.c1 = null;
          this.c2 = null;
          this.competenciasRanking = [];
          return of(null);
        }),
        finalize(() => {
          this.loadingOpcoes = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe((opcoes) => {
        if (!opcoes) {
          this.cdr.markForCheck();
          return;
        }
        this.silenciarFiltroChange = true;
        try {
          this.competenciasDisponiveis = opcoes.competenciasDisponiveis ?? [];
          this.representantes = opcoes.representantes;
          if (selecionarPadrao) {
            this.aplicarAnosPadrao();
            this.aplicarSelecaoPadraoComparar();
            this.aplicarSelecaoPadraoRanking();
          } else {
            this.sincronizarAnosComDisponiveis();
            this.podarSelecaoCompetencias();
          }
        } finally {
          this.silenciarFiltroChange = false;
        }
        this.cdr.markForCheck();
        // Busca automática após opções (mesmo comportamento de antes).
        this.reload$.next();
      });
  }

  /** Ano corrente se existir nos fechamentos; senão o mais recente disponível. */
  private aplicarAnosPadrao(): void {
    const anos = [
      ...new Set(this.competenciasDisponiveis.map((c) => c.ano)),
    ].sort((a, b) => b - a);
    if (!anos.length) {
      this.anosFiltro = [];
      return;
    }
    const corrente = new Date().getFullYear();
    this.anosFiltro = anos.includes(corrente) ? [corrente] : [anos[0]];
  }

  private sincronizarAnosComDisponiveis(): void {
    const anosOk = new Set(this.competenciasDisponiveis.map((c) => c.ano));
    this.anosFiltro = this.anosFiltro.filter((a) => anosOk.has(a));
    if (!this.anosFiltro.length && anosOk.size) {
      this.aplicarAnosPadrao();
    }
  }

  private podarSelecaoCompetencias(): void {
    const ok = new Set(this.competenciasFiltradas.map((c) => c.key));
    if (this.c1 != null && !ok.has(this.c1)) this.c1 = null;
    if (this.c2 != null && !ok.has(this.c2)) this.c2 = null;
    this.competenciasRanking = this.competenciasRanking.filter((k) =>
      ok.has(k),
    );
  }

  private aplicarSelecaoPadraoComparar(): void {
    this.aplicarSelecaoPadraoCompararSeVazio(true);
  }

  private aplicarSelecaoPadraoCompararSeVazio(forcar = false): void {
    const disponiveis = [...this.competenciasFiltradas];
    if (!forcar && this.c1 && this.c2 && this.c1 !== this.c2) {
      return;
    }
    if (disponiveis.length >= 2) {
      this.c1 = disponiveis[disponiveis.length - 2].key;
      this.c2 = disponiveis[disponiveis.length - 1].key;
    } else if (disponiveis.length === 1) {
      this.c1 = disponiveis[0].key;
      this.c2 = null;
    } else {
      this.c1 = null;
      this.c2 = null;
    }
  }

  private aplicarSelecaoPadraoRanking(): void {
    this.aplicarSelecaoPadraoRankingSeVazio(true);
  }

  private aplicarSelecaoPadraoRankingSeVazio(forcar = false): void {
    const disponiveis = [...this.competenciasFiltradas];
    if (!forcar && this.competenciasRanking.length) {
      return;
    }
    if (disponiveis.length >= 1) {
      this.competenciasRanking = [disponiveis[disponiveis.length - 1].key];
    } else {
      this.competenciasRanking = [];
    }
  }

  private ordenarKeys(keys: string[]): string[] {
    return [...new Set(keys.map(String))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }
}
