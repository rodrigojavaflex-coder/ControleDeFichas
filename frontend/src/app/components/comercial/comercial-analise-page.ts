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
import { catchError, debounceTime, finalize, switchMap } from 'rxjs/operators';
import ExcelJS from 'exceljs';
import { AuthService } from '../../services/auth.service';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { ComercialAnaliseService } from '../../services/comercial-analise.service';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  ComercialAnaliseBase,
  ComercialAnaliseDimensao,
  ComercialAnaliseLeitura,
  ComercialAnaliseLinha,
  ComercialAnaliseMetrica,
  ComercialAnaliseModo,
  ComercialAnalisePeriodo,
  ComercialAnaliseResponse,
  ComercialAnaliseVendedorOpcao,
  FindComercialAnaliseDto,
} from '../../models/comercial-analise.model';
import {
  MultiSelectDropdownComponent,
  MultiSelectOption,
} from '../multi-select-dropdown/multi-select-dropdown';

type Exibicao = 'dados' | 'graficos';
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
type FaixaAbs = 'faixa-abs-1' | 'faixa-abs-2' | 'faixa-abs-3' | 'faixa-abs-4';
type CardExport =
  | 'crescimento'
  | 'queda'
  | 'rejeitados'
  | 'vendas'
  | 'rejeitadosRanking';
type SortAlvo = 'cresc' | 'queda' | 'rej' | 'vendas' | 'rejRank';

@Component({
  selector: 'app-comercial-analise-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MultiSelectDropdownComponent],
  templateUrl: './comercial-analise-page.html',
  styleUrls: [
    '../vendas-list/vendas-list.css',
    '../visitacao/visitacao-analise-page.css',
    './comercial-analise-page.css',
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComercialAnalisePage implements OnInit, OnDestroy {
  private service = inject(ComercialAnaliseService);
  private authService = inject(AuthService);
  private pageContextService = inject(PageContextService);
  private errorModal = inject(ErrorModalService);
  private cdr = inject(ChangeDetectorRef);

  loading = false;
  loadingOpcoes = false;
  dados: ComercialAnaliseResponse | null = null;

  unidadeFilter: Unidade | '' = '';
  unidades = Object.values(Unidade);
  unidadeDisabled = false;

  modo: ComercialAnaliseModo = 'evolucao';
  dimensao: ComercialAnaliseDimensao = 'vendedor';
  metrica: ComercialAnaliseMetrica = 'valor';
  base: ComercialAnaliseBase = 'totalVendido';
  exibicao: Exibicao = 'graficos';
  leitura: ComercialAnaliseLeitura = 'comparar';

  competenciasDisponiveis: ComercialAnalisePeriodo[] = [];
  semanas: ComercialAnalisePeriodo[] = [];
  vendedores: ComercialAnaliseVendedorOpcao[] = [];
  anoCorrente = new Date().getFullYear();
  anosFiltro: number[] = [];
  c1: string | null = null;
  c2: string | null = null;
  competenciasRanking: string[] = [];
  s1: string | null = null;
  s2: string | null = null;
  /** Vendedores marcados; padrão = todos ao carregar o combo. */
  funcionarioIdsFiltro: string[] = [];

  filtroFaixaCresc: FaixaCresc | null = null;
  filtroFaixaQueda: FaixaQueda | null = null;
  filtroFaixaRej: FaixaAbs | null = null;

  sortCrescField: SortField = 'delta';
  sortCrescDir: SortDir = 'desc';
  sortQuedaField: SortField = 'delta';
  sortQuedaDir: SortDir = 'asc';
  sortRejField: SortField = 'delta';
  sortRejDir: SortDir = 'desc';
  sortVendasField: SortField = 'valorPeriodo';
  sortVendasDir: SortDir = 'desc';
  sortRejRankField: SortField = 'valorPeriodo';
  sortRejRankDir: SortDir = 'desc';

  private reload$ = new Subject<void>();
  private reloadSub?: Subscription;
  private opcoesSub?: Subscription;
  private silenciarFiltroChange = false;

  private readonly moedaFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  private readonly inteiroFormatter = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0,
  });
  private readonly percentualFormatter = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  ngOnInit(): void {
    if (!this.authService.hasPermission(Permission.COMERCIAL_ANALISE_READ)) {
      this.errorModal.show(
        'Você não possui permissão para visualizar a análise comercial.',
        'Sem permissão',
      );
      return;
    }
    this.initializeUnidadeFilter();
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
          this.cdr.markForCheck();
          return this.service.analisar(this.montarFiltros()).pipe(
            catchError((err: unknown) => {
              this.dados = null;
              this.errorModal.show(
                this.textoErro(err, 'Falha ao carregar a análise comercial.'),
                'Erro',
              );
              return of(null);
            }),
            finalize(() => {
              this.loading = false;
              this.cdr.markForCheck();
            }),
          );
        }),
      )
      .subscribe((resposta) => {
        if (resposta) {
          this.dados = resposta;
          this.resetFiltrosFaixa();
        }
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

  get isDados(): boolean {
    return this.exibicao === 'dados';
  }

  get isGraficos(): boolean {
    return this.exibicao === 'graficos';
  }

  get isSemanas(): boolean {
    return this.modo === 'semanas';
  }

  get isCompararMes(): boolean {
    return this.modo === 'comparar';
  }

  get isMultiCompetencias(): boolean {
    return this.modo === 'ranking' || this.modo === 'evolucao';
  }

  get layoutComparar(): boolean {
    if (!this.dados) return false;
    return (
      this.dados.modo === 'comparar' ||
      (this.dados.modo === 'semanas' &&
        this.dados.filtrosAplicados.leitura === 'comparar')
    );
  }

  get layoutRanking(): boolean {
    return this.dados?.modo === 'ranking';
  }

  get layoutEvolucao(): boolean {
    if (!this.dados) return false;
    return (
      this.dados.modo === 'evolucao' ||
      (this.dados.modo === 'semanas' &&
        this.dados.filtrosAplicados.leitura === 'evolucao')
    );
  }

  get metricaUsaMoeda(): boolean {
    return this.metrica === 'valor' || this.metrica === 'ticketMedio';
  }

  get anosOptions(): MultiSelectOption[] {
    const anos = [...new Set(this.competenciasDisponiveis.map((c) => this.anoDe(c)))];
    return anos.sort((a, b) => b - a).map((ano) => ({ value: ano, label: String(ano) }));
  }

  get competenciasFiltradas(): ComercialAnalisePeriodo[] {
    if (!this.anosFiltro.length) return [];
    const anos = new Set(this.anosFiltro.map(Number));
    return this.competenciasDisponiveis.filter((c) => anos.has(this.anoDe(c)));
  }

  get competenciasOptions(): MultiSelectOption[] {
    return this.competenciasFiltradas.map((c) => ({ value: c.key, label: c.label }));
  }

  get vendedoresOptions(): MultiSelectOption[] {
    return this.vendedores.map((v) => ({
      value: v.funcionarioId,
      label: v.nome,
    }));
  }

  get labelPeriodo1(): string {
    return this.dados?.periodo1?.labelCurto ?? 'Período 1';
  }

  get labelPeriodo2(): string {
    return this.dados?.periodo2?.labelCurto ?? 'Período 2';
  }

  get labelsSerie(): string[] {
    return (this.dados?.periodos ?? []).map((p) => p.labelCurto);
  }

  get rotuloBase(): string {
    const base = this.dados?.filtrosAplicados.base ?? this.base;
    switch (base) {
      case 'manipuladosRequisicoes':
        return 'Manipulado (requisições)';
      case 'manipuladosSetor':
        return 'Manipulado (setor)';
      case 'manipuladosTerceiros':
        return 'Manipulado (terceiros)';
      case 'manipulados':
        return 'Manipulado (total)';
      case 'marcaPropriaSetores':
        return 'Marca própria (setor)';
      case 'marcaPropriaOutros':
        return 'Marca própria (outros)';
      case 'marcaPropria':
        return 'Marca própria (total)';
      case 'totalVendido':
        return 'Total vendido';
      default:
        return 'Manipulado (total)';
    }
  }

  get isDimensaoVendedor(): boolean {
    return this.dimensao === 'vendedor';
  }

  /** Cabeçalho da 1ª coluna / Excel: Vendedor ou Unidade. */
  get rotuloLinha(): string {
    return this.dimensao === 'unidade' ? 'Unidade' : 'Vendedor';
  }

  get crescimentoVisivel(): ComercialAnaliseLinha[] {
    return this.ordenar(this.dados?.crescimento ?? [], this.sortCrescField, this.sortCrescDir)
      .filter((item) => !this.filtroFaixaCresc || this.faixaDelta(item.delta) === this.filtroFaixaCresc);
  }

  get quedaVisivel(): ComercialAnaliseLinha[] {
    return this.ordenar(this.dados?.queda ?? [], this.sortQuedaField, this.sortQuedaDir)
      .filter((item) => !this.filtroFaixaQueda || this.faixaDelta(item.delta) === this.filtroFaixaQueda);
  }

  get rejeitadosVisivel(): ComercialAnaliseLinha[] {
    return this.ordenar(this.dados?.maioresRejeitados ?? [], this.sortRejField, this.sortRejDir)
      .filter((item) => !this.filtroFaixaRej || this.faixaAbsDelta(item.delta) === this.filtroFaixaRej);
  }

  get vendasVisivel(): ComercialAnaliseLinha[] {
    return this.ordenar(this.dados?.maioresVendas ?? [], this.sortVendasField, this.sortVendasDir);
  }

  get rejeitadosRankingVisivel(): ComercialAnaliseLinha[] {
    return this.ordenar(
      this.dados?.maioresRejeitados ?? [],
      this.sortRejRankField,
      this.sortRejRankDir,
    );
  }

  get maxMesesCrescimento(): number {
    return this.maxMeses(this.crescimentoVisivel);
  }
  get maxMesesQueda(): number {
    return this.maxMeses(this.quedaVisivel);
  }
  get maxMesesRejeitados(): number {
    return this.maxMeses(this.rejeitadosVisivel);
  }
  get maxVendasBar(): number {
    return this.maxPeriodo(this.vendasVisivel);
  }
  get maxRejeitadosBar(): number {
    return this.maxPeriodo(this.rejeitadosRankingVisivel);
  }
  get maxSerieVendas(): number {
    return this.maxSerie(this.vendasVisivel);
  }
  get maxSerieRejeitados(): number {
    return this.maxSerie(this.rejeitadosRankingVisivel);
  }
  get podeAtualizar(): boolean {
    return this.podeAnalisar();
  }

  onUnidadeChange(unidade: Unidade | ''): void {
    this.unidadeFilter = unidade;
    this.dados = null;
    this.carregarOpcoes(true);
  }

  onAnosChange(values: number[]): void {
    this.anosFiltro = [...new Set(values.map(Number))].sort((a, b) => b - a);
    this.podarSelecao();
    if (this.isCompararMes) this.aplicarSelecaoComparar(false);
    if (this.modo === 'evolucao') this.aplicarSelecaoEvolucao(false);
    if (this.modo === 'ranking') this.aplicarSelecaoRanking(false);
    this.onFiltroChange();
  }

  onModoChange(modo: ComercialAnaliseModo): void {
    this.modo = modo;
    this.dados = null;
    this.resetFiltrosFaixa();
    this.atualizarPageContext();
    if (modo === 'ranking') this.aplicarSelecaoRanking(true);
    else if (modo === 'evolucao') this.aplicarSelecaoEvolucao(true);
    else if (modo === 'comparar') this.aplicarSelecaoComparar(true);
    else this.aplicarSemanasPadrao(false);
    this.onFiltroChange();
  }

  onDimensaoChange(dimensao: ComercialAnaliseDimensao): void {
    this.dimensao = dimensao;
    this.dados = null;
    this.resetFiltrosFaixa();
    this.atualizarPageContext();
    this.onFiltroChange();
  }

  onExibicaoChange(exibicao: Exibicao): void {
    this.exibicao = exibicao;
    this.cdr.markForCheck();
  }

  onMetricaChange(metrica: ComercialAnaliseMetrica): void {
    this.metrica = metrica;
    this.resetFiltrosFaixa();
    this.onFiltroChange();
  }

  onBaseChange(base: ComercialAnaliseBase): void {
    this.base = base;
    this.onFiltroChange();
  }

  onLeituraChange(leitura: ComercialAnaliseLeitura): void {
    this.leitura = leitura;
    this.dados = null;
    this.atualizarPageContext();
    this.onFiltroChange();
  }

  onC1Change(c1: string | null): void {
    this.c1 = c1;
    this.onFiltroChange();
  }
  onC2Change(c2: string | null): void {
    this.c2 = c2;
    this.onFiltroChange();
  }
  onCompetenciasChange(values: string[]): void {
    this.competenciasRanking = this.ordenarKeys(values);
    this.onFiltroChange();
  }
  onS1Change(s1: string | null): void {
    this.s1 = s1;
    this.onFiltroChange();
  }
  onS2Change(s2: string | null): void {
    this.s2 = s2;
    this.onFiltroChange();
  }
  onVendedoresChange(ids: string[]): void {
    this.funcionarioIdsFiltro = [...new Set((ids ?? []).map(String).filter(Boolean))];
    this.onFiltroChange();
  }

  atualizarAnalise(): void {
    if (!this.podeAnalisar() || this.loading || this.loadingOpcoes) return;
    this.reload$.next();
  }

  onFiltroChange(): void {
    if (this.silenciarFiltroChange || this.loadingOpcoes) return;
    this.reload$.next();
  }

  onSort(qual: SortAlvo, field: SortField): void {
    const par = this.parSort(qual);
    if (par.field === field) {
      par.dir = par.dir === 'asc' ? 'desc' : 'asc';
    } else {
      par.field = field;
      par.dir = field === 'nome' ? 'asc' : 'desc';
    }
    this.aplicarSort(qual, par.field, par.dir);
    this.cdr.markForCheck();
  }

  limparFaixaCresc(): void {
    this.filtroFaixaCresc = null;
    this.cdr.markForCheck();
  }
  toggleFaixaCresc(faixa: FaixaCresc): void {
    this.filtroFaixaCresc = this.filtroFaixaCresc === faixa ? null : faixa;
    this.cdr.markForCheck();
  }
  limparFaixaQueda(): void {
    this.filtroFaixaQueda = null;
    this.cdr.markForCheck();
  }
  toggleFaixaQueda(faixa: FaixaQueda): void {
    this.filtroFaixaQueda = this.filtroFaixaQueda === faixa ? null : faixa;
    this.cdr.markForCheck();
  }
  limparFaixaRej(): void {
    this.filtroFaixaRej = null;
    this.cdr.markForCheck();
  }
  toggleFaixaRej(faixa: FaixaAbs): void {
    this.filtroFaixaRej = this.filtroFaixaRej === faixa ? null : faixa;
    this.cdr.markForCheck();
  }

  formatarValor(v: number | null | undefined): string {
    if (v == null) return '—';
    if (this.metrica === 'quantidade') return this.inteiroFormatter.format(v);
    return this.moedaFormatter.format(v);
  }

  formatarDelta(v: number): string {
    const sinal = v > 0 ? '+' : '';
    if (this.metrica === 'quantidade') {
      return `${sinal}${this.inteiroFormatter.format(v)}`;
    }
    return `${sinal}${this.moedaFormatter.format(v)}`;
  }

  formatarPercentual(v: number | null | undefined): string {
    if (v == null) return '—';
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

  trackByVendedor(_: number, item: ComercialAnaliseLinha): string {
    return item.funcionarioId;
  }

  percentualBarra(valor: number | null | undefined, max: number): number {
    if (!max || valor == null || !Number.isFinite(Number(valor))) return 0;
    return Math.min(100, (Math.abs(Number(valor)) / max) * 100);
  }

  pontosSetaComparar(
    valorMes1: number | null | undefined,
    valorMes2: number | null | undefined,
    max: number,
  ): string {
    if (!max) return '';
    const y1 = 100 - this.percentualBarra(valorMes1, max);
    const y2 = 100 - this.percentualBarra(valorMes2, max);
    return `25,${y1} 75,${y2}`;
  }

  pontosLinhaSerie(serie: Array<number | null> | undefined, max: number): string {
    if (!serie?.length || !max) return '';
    const n = serie.length;
    return serie
      .map((v, i) => {
        const x = ((i + 0.5) / n) * 100;
        const y = 100 - this.percentualBarra(v, max);
        return `${x},${y}`;
      })
      .join(' ');
  }

  valorSerie(item: ComercialAnaliseLinha, index: number): number | null {
    return item.serie?.[index] ?? null;
  }

  /** Δ da série: última competência − primeira (seta no gráfico Evolução). */
  deltaSerie(item: ComercialAnaliseLinha): number {
    const serie = item.serie ?? [];
    if (serie.length < 2) return 0;
    return (Number(serie[serie.length - 1]) || 0) - (Number(serie[0]) || 0);
  }

  async exportarExcel(card: CardExport): Promise<void> {
    if (!this.dados || this.exibicao !== 'dados') return;
    if (card === 'vendas' || card === 'rejeitadosRanking') {
      if (this.layoutEvolucao) await this.exportarSerie(card);
      else await this.exportarRanking(card);
      return;
    }
    const mapa = {
      crescimento: {
        lista: this.dados.crescimento,
        titulo: 'Maior crescimento',
        coluna: 'Aumento',
        arquivo: 'comercial_analise_crescimento',
      },
      queda: {
        lista: this.dados.queda,
        titulo: 'Maior queda',
        coluna: 'Queda',
        arquivo: 'comercial_analise_queda',
      },
      rejeitados: {
        lista: this.dados.maioresRejeitados,
        titulo: 'Rejeitados',
        coluna: 'Diferença',
        arquivo: 'comercial_analise_rejeitados',
      },
    } as const;
    const alvo = mapa[card];
    if (!alvo.lista.length) return;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(alvo.titulo.slice(0, 31));
    sheet.columns = [
      { header: this.rotuloLinha, key: 'nome', width: 40 },
      { header: this.labelPeriodo1, key: 'p1', width: 18 },
      { header: this.labelPeriodo2, key: 'p2', width: 18 },
      { header: alvo.coluna, key: 'delta', width: 14 },
      { header: '%', key: 'pct', width: 12 },
    ];
    for (const item of alvo.lista) {
      sheet.addRow({
        nome: item.nomeVendedor,
        p1: item.valorMes1,
        p2: item.valorMes2,
        delta: item.delta,
        pct: item.percentual,
      });
    }
    sheet.getRow(1).font = { bold: true };
    await this.baixar(
      workbook,
      `${alvo.arquivo}_${this.dados.unidade}_${this.dados.periodo1?.key ?? 'p1'}_${this.dados.periodo2?.key ?? 'p2'}`,
    );
  }

  private async exportarRanking(card: 'vendas' | 'rejeitadosRanking'): Promise<void> {
    if (!this.dados) return;
    const vendas = card === 'vendas';
    const lista = vendas ? this.dados.maioresVendas : this.dados.maioresRejeitados;
    if (!lista.length) return;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(vendas ? 'Maiores vendas' : 'Mais rejeitados');
    sheet.columns = [
      { header: this.rotuloLinha, key: 'nome', width: 40 },
      { header: 'Total', key: 'total', width: 16 },
      { header: 'Média', key: 'media', width: 16 },
    ];
    for (const item of lista) {
      sheet.addRow({ nome: item.nomeVendedor, total: item.valorPeriodo, media: item.valorMedia });
    }
    sheet.getRow(1).font = { bold: true };
    await this.baixar(
      workbook,
      `comercial_analise_${vendas ? 'vendas' : 'rejeitados'}_${this.dados.unidade}`,
    );
  }

  private async exportarSerie(card: 'vendas' | 'rejeitadosRanking'): Promise<void> {
    if (!this.dados) return;
    const vendas = card === 'vendas';
    const lista = vendas ? this.dados.maioresVendas : this.dados.maioresRejeitados;
    if (!lista.length) return;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet((vendas ? this.rotuloBase : 'Rejeitados').slice(0, 31));
    sheet.addRow([
      this.rotuloLinha,
      ...this.dados.periodos.map((p) => p.labelCurto),
      'Total',
    ]);
    for (const item of lista) {
      sheet.addRow([
        item.nomeVendedor,
        ...this.dados.periodos.map((_, i) => item.serie?.[i] ?? null),
        item.valorPeriodo,
      ]);
    }
    sheet.getRow(1).font = { bold: true };
    await this.baixar(
      workbook,
      `comercial_analise_serie_${vendas ? 'vendas' : 'rejeitados'}_${this.dados.unidade}`,
    );
  }

  private async baixar(workbook: ExcelJS.Workbook, nome: string): Promise<void> {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nome}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private parSort(qual: SortAlvo): { field: SortField; dir: SortDir } {
    if (qual === 'cresc') return { field: this.sortCrescField, dir: this.sortCrescDir };
    if (qual === 'queda') return { field: this.sortQuedaField, dir: this.sortQuedaDir };
    if (qual === 'rej') return { field: this.sortRejField, dir: this.sortRejDir };
    if (qual === 'vendas') return { field: this.sortVendasField, dir: this.sortVendasDir };
    return { field: this.sortRejRankField, dir: this.sortRejRankDir };
  }

  private aplicarSort(qual: SortAlvo, field: SortField, dir: SortDir): void {
    if (qual === 'cresc') {
      this.sortCrescField = field;
      this.sortCrescDir = dir;
    } else if (qual === 'queda') {
      this.sortQuedaField = field;
      this.sortQuedaDir = dir;
    } else if (qual === 'rej') {
      this.sortRejField = field;
      this.sortRejDir = dir;
    } else if (qual === 'vendas') {
      this.sortVendasField = field;
      this.sortVendasDir = dir;
    } else {
      this.sortRejRankField = field;
      this.sortRejRankDir = dir;
    }
  }

  private ordenar(
    lista: ComercialAnaliseLinha[],
    field: SortField,
    dir: SortDir,
  ): ComercialAnaliseLinha[] {
    const fator = dir === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) => {
      if (field === 'nome') {
        return a.nomeVendedor.localeCompare(b.nomeVendedor, 'pt-BR') * fator;
      }
      const av = a[field];
      const bv = b[field];
      if (av == null && bv == null) {
        return a.nomeVendedor.localeCompare(b.nomeVendedor, 'pt-BR');
      }
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av !== bv) return (Number(av) - Number(bv)) * fator;
      return a.nomeVendedor.localeCompare(b.nomeVendedor, 'pt-BR');
    });
  }

  private maxMeses(lista: ComercialAnaliseLinha[]): number {
    let max = 0;
    for (const item of lista) {
      max = Math.max(max, Math.abs(item.valorMes1 ?? 0), Math.abs(item.valorMes2 ?? 0));
    }
    return max;
  }

  private maxPeriodo(lista: ComercialAnaliseLinha[]): number {
    let max = 0;
    for (const item of lista) max = Math.max(max, Math.abs(item.valorPeriodo ?? 0));
    return max;
  }

  private maxSerie(lista: ComercialAnaliseLinha[]): number {
    let max = 0;
    for (const item of lista) {
      for (const v of item.serie ?? []) max = Math.max(max, Math.abs(Number(v) || 0));
    }
    return max;
  }

  private podeAnalisar(): boolean {
    if (!this.unidadeFilter) return false;
    if (this.modo === 'comparar') return !!this.c1 && !!this.c2 && this.c1 !== this.c2;
    if (this.modo === 'ranking') return this.competenciasRanking.length >= 1;
    if (this.modo === 'evolucao') return this.competenciasRanking.length >= 2;
    if (this.leitura === 'evolucao') return this.semanas.length >= 1;
    return !!this.s1 && !!this.s2 && this.s1 !== this.s2;
  }

  private montarFiltros(): FindComercialAnaliseDto {
    const filtros: FindComercialAnaliseDto = {
      modo: this.modo,
      dimensao: this.dimensao,
      metrica: this.metrica,
      base: this.base,
      unidade: this.unidadeFilter as Unidade,
    };
    if (this.dimensao === 'vendedor') {
      filtros.funcionarioIds = [...this.funcionarioIdsFiltro];
    }
    if (this.modo === 'comparar') {
      filtros.c1 = this.c1 ?? undefined;
      filtros.c2 = this.c2 ?? undefined;
    } else if (this.modo === 'ranking' || this.modo === 'evolucao') {
      filtros.competencias = [...this.competenciasRanking];
    } else {
      filtros.leitura = this.leitura;
      if (this.leitura === 'comparar') {
        filtros.s1 = this.s1 ?? undefined;
        filtros.s2 = this.s2 ?? undefined;
      }
    }
    return filtros;
  }

  private carregarOpcoes(selecionarPadrao: boolean): void {
    if (!this.unidadeFilter) {
      this.competenciasDisponiveis = [];
      this.semanas = [];
      this.vendedores = [];
      this.anosFiltro = [];
      this.loadingOpcoes = false;
      this.cdr.markForCheck();
      return;
    }
    this.loadingOpcoes = true;
    this.opcoesSub?.unsubscribe();
    this.opcoesSub = this.service
      .opcoes({ unidade: this.unidadeFilter as Unidade })
      .pipe(
        catchError((err: unknown) => {
          this.errorModal.show(
            this.textoErro(err, 'Falha ao carregar as opções da análise.'),
            'Erro',
          );
          this.competenciasDisponiveis = [];
          this.semanas = [];
          this.vendedores = [];
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
          this.aplicarOpcoes(opcoes, selecionarPadrao);
        } finally {
          this.silenciarFiltroChange = false;
        }
        this.cdr.markForCheck();
        // Direto no Subject: onFiltroChange ainda vê loadingOpcoes=true
        // (finalize corre depois do next do HTTP).
        this.reload$.next();
      });
  }

  private aplicarOpcoes(
    opcoes: {
      anoCorrente: number;
      competencias: ComercialAnalisePeriodo[];
      semanas: ComercialAnalisePeriodo[];
      vendedores: ComercialAnaliseVendedorOpcao[];
    },
    selecionarPadrao: boolean,
  ): void {
    this.anoCorrente = opcoes.anoCorrente;
    this.competenciasDisponiveis = opcoes.competencias ?? [];
    this.semanas = opcoes.semanas ?? [];
    this.vendedores = opcoes.vendedores ?? [];
    const idsValidos = new Set(this.vendedores.map((v) => v.funcionarioId));
    if (selecionarPadrao) {
      this.funcionarioIdsFiltro = this.vendedores.map((v) => v.funcionarioId);
      const ano = this.competenciasDisponiveis.some((c) => this.anoDe(c) === this.anoCorrente)
        ? this.anoCorrente
        : this.anoDe(
            this.competenciasDisponiveis[this.competenciasDisponiveis.length - 1],
          ) || this.anoCorrente;
      this.anosFiltro = [ano];
      this.aplicarSelecaoComparar(true);
      this.aplicarSelecaoRanking(true);
      // Evolução por último: padrão = duas últimas competências do ano.
      this.aplicarSelecaoEvolucao(true);
      this.aplicarSemanasPadrao(true);
    } else {
      this.funcionarioIdsFiltro = this.funcionarioIdsFiltro.filter((id) =>
        idsValidos.has(id),
      );
      this.podarSelecao();
    }
  }

  private aplicarSelecaoComparar(forcar: boolean): void {
    const disponiveis = this.competenciasFiltradas;
    if (!forcar && this.c1 && this.c2 && this.c1 !== this.c2) return;
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

  private aplicarSelecaoRanking(forcar: boolean): void {
    const disponiveis = this.competenciasFiltradas;
    if (!forcar && this.competenciasRanking.length) return;
    this.competenciasRanking = disponiveis.length
      ? [disponiveis[disponiveis.length - 1].key]
      : [];
  }

  private aplicarSelecaoEvolucao(forcar: boolean): void {
    const disponiveis = this.competenciasFiltradas;
    if (!forcar && this.competenciasRanking.length >= 2) return;
    if (disponiveis.length >= 2) {
      this.competenciasRanking = [
        disponiveis[disponiveis.length - 2].key,
        disponiveis[disponiveis.length - 1].key,
      ];
    } else {
      this.competenciasRanking = disponiveis.map((c) => c.key);
    }
  }

  private aplicarSemanasPadrao(forcar: boolean): void {
    if (!forcar && this.s1 && this.s2 && this.s1 !== this.s2) return;
    if (this.semanas.length >= 2) {
      this.s1 = this.semanas[this.semanas.length - 2].key;
      this.s2 = this.semanas[this.semanas.length - 1].key;
    } else if (this.semanas.length === 1) {
      this.s1 = this.semanas[0].key;
      this.s2 = null;
    } else {
      this.s1 = null;
      this.s2 = null;
    }
  }

  private podarSelecao(): void {
    const keys = new Set(this.competenciasFiltradas.map((c) => c.key));
    if (this.c1 && !keys.has(this.c1)) this.c1 = null;
    if (this.c2 && !keys.has(this.c2)) this.c2 = null;
    this.competenciasRanking = this.competenciasRanking.filter((k) => keys.has(k));
  }

  private ordenarKeys(keys: string[]): string[] {
    return [...new Set(keys.map(String))].filter(Boolean).sort((a, b) => a.localeCompare(b));
  }

  private resetFiltrosFaixa(): void {
    this.filtroFaixaCresc = null;
    this.filtroFaixaQueda = null;
    this.filtroFaixaRej = null;
  }

  private atualizarPageContext(): void {
    const eixo =
      this.dimensao === 'unidade' ? 'pelo total da loja' : 'por vendedor';
    const description = this.isSemanas
      ? `Semanas do mês corrente ${eixo}. A semana em curso vai até hoje e fica como prévia.`
      : this.modo === 'ranking'
        ? `Ranking de vendas e rejeitados ${eixo} no período selecionado.`
        : this.modo === 'evolucao'
          ? `Série mensal ${eixo} nas competências selecionadas (mínimo 2).`
          : `Crescimento, queda e rejeitados entre duas competências, ${eixo}.`;
    this.pageContextService.setContext({
      title: 'Análise Comercial',
      description,
    });
  }

  private initializeUnidadeFilter(): void {
    const raw = this.authService.getCurrentUser()?.unidade?.trim() ?? '';
    const match = this.unidades.find((u) => u === raw);
    if (match) {
      this.unidadeFilter = match;
      this.unidadeDisabled = true;
    } else {
      this.unidadeFilter = '';
      this.unidadeDisabled = false;
    }
  }

  private anoDe(periodo: ComercialAnalisePeriodo | undefined): number {
    const match = /^(\d{4})-/.exec(periodo?.key ?? '');
    return match ? Number(match[1]) : 0;
  }

  private textoErro(err: unknown, fallback: string): string {
    const message = (err as { error?: { message?: unknown } })?.error?.message;
    if (Array.isArray(message)) return message.map(String).join('\n');
    if (typeof message === 'string' && message.trim()) return message;
    return fallback;
  }
}
