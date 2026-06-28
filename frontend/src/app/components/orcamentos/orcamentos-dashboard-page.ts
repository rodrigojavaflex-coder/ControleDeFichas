import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  ViewEncapsulation,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, finalize, switchMap, timeout } from 'rxjs/operators';
import { OrcamentosService } from '../../services/orcamentos.service';
import { AuthService } from '../../services/auth.service';
import { PageContextService } from '../../services/page-context.service';
import { OrcamentoStatus, OrcamentoMedicoOpcaoFiltro } from '../../models/orcamento.model';
import {
  FindOrcamentosDashboardDto,
  DashboardUnidadePerformanceDetalhe,
  DashboardVendedorDetalhe,
  DashboardPerformanceMedico,
  DashboardParetoItem,
  OrcamentosDashboardIndicadores,
} from '../../models/orcamento-dashboard.model';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  DateRangeFilterComponent,
  DateRangeValue,
} from '../date-range-filter/date-range-filter';
import { MedicoFilterPickerComponent } from '../medico-filter-picker/medico-filter-picker';

@Component({
  selector: 'app-orcamentos-dashboard-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DateRangeFilterComponent, MedicoFilterPickerComponent],
  templateUrl: './orcamentos-dashboard-page.html',
  styleUrls: ['../vendas-list/vendas-list.css', './orcamentos-dashboard-page.css'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrcamentosDashboardPage implements OnInit, OnDestroy {
  private orcamentosService = inject(OrcamentosService);
  private authService = inject(AuthService);
  private pageContextService = inject(PageContextService);
  private cdr = inject(ChangeDetectorRef);

  Permission = Permission;
  OrcamentoStatus = OrcamentoStatus;

  readonly performanceMetricColunas = [
    {
      key: 'quantidadeTotal' as const,
      titulo: 'Total orçamentos',
      barClass: 'bar-fill-primary',
      formato: 'inteiro' as const,
    },
    {
      key: 'quantidadeAprovada' as const,
      titulo: 'Aprovados',
      barClass: 'bar-fill-success',
      formato: 'inteiro' as const,
    },
    {
      key: 'quantidadeRejeitada' as const,
      titulo: 'Rejeitados',
      barClass: 'bar-fill-danger',
      formato: 'inteiro' as const,
    },
    {
      key: 'taxaConversao' as const,
      titulo: 'Conversão',
      barClass: 'bar-fill-primary',
      formato: 'percentual' as const,
    },
  ];

  readonly paretoBarClasses = [
    'bar-fill-danger',
    'bar-fill-primary',
    'bar-fill-info',
    'bar-fill-success',
    'bar-fill-warning',
    'bar-fill-secondary',
    'bar-fill-accent-purple',
    'bar-fill-accent-orange',
  ] as const;

  loading = false;
  error = '';
  dados: OrcamentosDashboardIndicadores | null = null;

  dataInicialFilter = '';
  dataFinalFilter = '';

  unidades = Object.values(Unidade);
  unidadeDisabled = false;
  selectedUnidades = new Set<Unidade>();

  opcoesVendedor: string[] = [];
  opcoesMedico: OrcamentoMedicoOpcaoFiltro[] = [];
  buscaVendedorModal = '';
  loadingOpcoesFiltro = false;
  selectedVendedores = new Set<string>();
  selectedMedicos = new Set<string>();
  vendedorModalOpen = false;
  selectedVendedoresRascunho = new Set<string>();
  filtersSidebarHidden = false;
  performanceCardsCollapsed = {
    vendedor: false,
    unidade: false,
    medico: false,
  };
  appliedFilters: { key: string; label: string; value: string }[] = [];

  private reload$ = new Subject<void>();
  private reloadSub?: Subscription;
  private opcoesFiltroReloadPendente = false;
  private readonly moedaFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
  private readonly inteiroFormatter = new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 0,
  });
  private readonly percentualFormatter = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  ngOnInit(): void {
    if (!this.canRead()) {
      this.error = 'Você não possui permissão para visualizar o painel de orçamentos.';
      return;
    }

    this.initializeUnidadeFilter();
    this.initializeDateFilters();
    this.buildAppliedFilters();

    this.pageContextService.setContext({
      title: 'Indicadores de orçamentos',
      description:
        'KPIs e gráficos analíticos de conversão, receita aprovada e perdas por motivo.',
    });

    this.reloadSub = this.reload$
      .pipe(
        debounceTime(150),
        switchMap(() => {
          this.loading = true;
          return this.orcamentosService
            .getDashboardIndicadores(this.buildFilters())
            .pipe(
              timeout(20000),
              catchError((err) => {
                this.error =
                  err?.name === 'TimeoutError'
                    ? 'Tempo de resposta excedido ao carregar indicadores. Ajuste os filtros e tente novamente.'
                    : err?.error?.message ?? 'Erro ao carregar indicadores do dashboard.';
                this.dados = null;
                this.cdr.markForCheck();
                return of(null);
              }),
              finalize(() => {
                this.loading = false;
                this.cdr.markForCheck();
              }),
            );
        }),
      )
      .subscribe({
        next: (data) => {
          if (!data) {
            return;
          }
          this.dados = data;
          this.cdr.markForCheck();
        },
      });

    this.triggerReload();
    this.loadOpcoesFiltro();
  }

  ngOnDestroy(): void {
    this.reloadSub?.unsubscribe();
  }

  canRead(): boolean {
    return this.authService.hasPermission(Permission.ORCAMENTO_DASHBOARD_READ);
  }

  canViewValores(): boolean {
    if (this.dados) {
      return this.dados.filtrosAplicados.visualizarValores;
    }
    return this.authService.hasPermission(
      Permission.ORCAMENTO_DASHBOARD_VIEW_VALORES,
    );
  }

  toggleFiltersSidebar(): void {
    this.filtersSidebarHidden = !this.filtersSidebarHidden;
  }

  togglePerformanceCard(card: 'vendedor' | 'unidade' | 'medico'): void {
    this.performanceCardsCollapsed[card] = !this.performanceCardsCollapsed[card];
    this.cdr.markForCheck();
  }

  isPerformanceCardCollapsed(card: 'vendedor' | 'unidade' | 'medico'): boolean {
    return this.performanceCardsCollapsed[card];
  }

  clearFilters(): void {
    this.selectedUnidades.clear();
    if (this.unidadeDisabled && this.authService.getCurrentUser()?.unidade) {
      this.selectedUnidades.add(this.authService.getCurrentUser()!.unidade!);
    }
    this.selectedVendedores.clear();
    this.selectedMedicos.clear();
    this.buscaVendedorModal = '';
    this.initializeDateFilters();
    this.applyFiltersAutomatically(true);
  }

  atualizarPainel(): void {
    this.applyFiltersAutomatically(true);
  }

  onDateRangeChange(range: DateRangeValue): void {
    this.dataInicialFilter = range.start;
    this.dataFinalFilter = range.end;
    this.applyFiltersAutomatically(true);
  }

  toggleUnidade(unidade: Unidade, checked: boolean): void {
    if (this.unidadeDisabled) return;
    if (checked) this.selectedUnidades.add(unidade);
    else this.selectedUnidades.delete(unidade);
    this.applyFiltersAutomatically(true);
  }

  get opcoesVendedorFiltradas(): string[] {
    const termo = this.normalizarTexto(this.buscaVendedorModal);
    if (!termo) return this.opcoesVendedor;
    return this.opcoesVendedor.filter((nome) =>
      this.normalizarTexto(nome).includes(termo),
    );
  }

  get sugestoesVendedor(): string[] {
    return this.opcoesVendedorFiltradas.slice(0, 300);
  }

  get vendedorResumo(): string {
    return this.selectedVendedores.size === 0
      ? 'Todos'
      : `${this.selectedVendedores.size} selecionado(s)`;
  }

  get vendedoresSelecionadosLista(): string[] {
    return Array.from(this.selectedVendedores).sort((a, b) =>
      a.localeCompare(b, 'pt-BR'),
    );
  }

  abrirModalVendedores(): void {
    this.selectedVendedoresRascunho = new Set(this.selectedVendedores);
    this.buscaVendedorModal = '';
    this.vendedorModalOpen = true;
  }

  fecharModalVendedores(): void {
    this.vendedorModalOpen = false;
    this.buscaVendedorModal = '';
  }

  onMedicosSelected(medicos: Set<string>): void {
    this.selectedMedicos = medicos;
    this.cdr.markForCheck();
  }

  onMedicosConfirmados(): void {
    this.applyFiltersAutomatically(true);
  }

  onMedicosLimpos(): void {
    this.applyFiltersAutomatically(true);
  }

  toggleVendedorRascunho(nome: string, checked: boolean): void {
    if (checked) this.selectedVendedoresRascunho.add(nome);
    else this.selectedVendedoresRascunho.delete(nome);
  }

  get todosVendedoresFiltradosMarcados(): boolean {
    return this.sugestoesVendedor.length > 0 &&
      this.sugestoesVendedor.every((nome) => this.selectedVendedoresRascunho.has(nome));
  }

  toggleTodosVendedoresRascunho(checked: boolean): void {
    if (checked) {
      for (const nome of this.sugestoesVendedor) {
        this.selectedVendedoresRascunho.add(nome);
      }
      return;
    }
    for (const nome of this.sugestoesVendedor) {
      this.selectedVendedoresRascunho.delete(nome);
    }
  }

  confirmarVendedores(): void {
    this.selectedVendedores = new Set(this.selectedVendedoresRascunho);
    this.fecharModalVendedores();
    this.applyFiltersAutomatically(true);
  }

  limparVendedoresSelecionados(): void {
    this.selectedVendedores.clear();
    this.applyFiltersAutomatically(true);
  }

  selecionarTodasUnidades(): void {
    if (this.unidadeDisabled) return;
    this.unidades.forEach((u) => this.selectedUnidades.add(u));
    this.applyFiltersAutomatically(true);
  }

  limparUnidades(): void {
    if (this.unidadeDisabled) return;
    this.selectedUnidades.clear();
    this.applyFiltersAutomatically(true);
  }

  onUnidadesContainerClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Mantém o comportamento de clique individual nos itens e ações internas.
    if (
      target.closest('.unidade-item') ||
      target.closest('.filter-section-actions') ||
      target.closest('button') ||
      target.closest('input')
    ) {
      return;
    }

    this.toggleTodasUnidades();
  }

  toggleTodasUnidades(): void {
    if (this.unidadeDisabled) return;
    const todasSelecionadas = this.selectedUnidades.size === this.unidades.length;
    if (todasSelecionadas) {
      this.selectedUnidades.clear();
    } else {
      this.unidades.forEach((u) => this.selectedUnidades.add(u));
    }
    this.applyFiltersAutomatically(true);
  }

  get totalFiltrosAplicados(): number {
    return this.appliedFilters.length;
  }

  get resumoPeriodoTexto(): string {
    if (!this.dataInicialFilter && !this.dataFinalFilter) {
      return 'Todos';
    }
    const inicio = this.dataInicialFilter ? this.formatarData(this.dataInicialFilter) : '...';
    const fim = this.dataFinalFilter ? this.formatarData(this.dataFinalFilter) : '...';
    return `${inicio} a ${fim}`;
  }

  get resumoUnidadesTexto(): string {
    if (this.selectedUnidades.size === 0 || this.selectedUnidades.size === this.unidades.length) {
      return 'Todas';
    }
    return Array.from(this.selectedUnidades)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .join(', ');
  }

  get resumoVendedoresTexto(): string {
    if (this.selectedVendedores.size === 0) {
      return 'Todos';
    }
    if (this.selectedVendedores.size === 1) {
      return '1 Vendedor';
    }
    return `${this.selectedVendedores.size} Vendedores`;
  }

  get resumoMedicosTexto(): string {
    if (this.selectedMedicos.size === 0) {
      return 'Todos';
    }
    if (this.selectedMedicos.size === 1) {
      return '1 Médico';
    }
    return `${this.selectedMedicos.size} Médicos`;
  }

  formatarMoeda(valor: number | null | undefined): string {
    return this.moedaFormatter.format(valor ?? 0);
  }

  formatarInteiro(valor: number | null | undefined): string {
    return this.inteiroFormatter.format(valor ?? 0);
  }

  formatarPercentual(valor: number | null | undefined): string {
    return `${this.percentualFormatter.format(valor ?? 0)}%`;
  }

  getPercentualRejeicao(quantidadeTotal: number, quantidadeAprovada: number): number {
    if (!quantidadeTotal || quantidadeTotal <= 0) {
      return 0;
    }
    const rejeitados = quantidadeTotal - quantidadeAprovada;
    return (rejeitados / quantidadeTotal) * 100;
  }

  formatarData(data: string | null | undefined): string {
    if (!data) return '';
    const [y, m, d] = data.split('-');
    if (!y || !m || !d) return data;
    return `${d}/${m}/${y}`;
  }

  private initializeUnidadeFilter(): void {
    const user = this.authService.getCurrentUser();
    if (user?.unidade) {
      this.selectedUnidades.add(user.unidade);
      this.unidadeDisabled = true;
    }
  }

  private initializeDateFilters(): void {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    this.dataInicialFilter = this.formatDateLocal(start);
    this.dataFinalFilter = this.formatDateLocal(now);
  }

  private formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalizarTexto(valor: string): string {
    return (valor ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private buildFilters(): FindOrcamentosDashboardDto {
    return {
      dataInicial: this.dataInicialFilter || undefined,
      dataFinal: this.dataFinalFilter || undefined,
      unidades:
        this.selectedUnidades.size > 0
          ? Array.from(this.selectedUnidades)
          : undefined,
      nomesVendedor:
        this.selectedVendedores.size > 0
          ? Array.from(this.selectedVendedores)
          : undefined,
      nomesMedico:
        this.selectedMedicos.size > 0
          ? Array.from(this.selectedMedicos)
          : undefined,
      status: [OrcamentoStatus.APROVADO, OrcamentoStatus.REJEITADO],
    };
  }

  private loadOpcoesFiltro(force = false): void {
    if (this.loadingOpcoesFiltro) {
      if (force) {
        this.opcoesFiltroReloadPendente = true;
      }
      return;
    }
    if (!force && (this.opcoesVendedor.length > 0 || this.opcoesMedico.length > 0)) return;

    this.loadingOpcoesFiltro = true;
    this.opcoesFiltroReloadPendente = false;
    const base = {
      dataInicial: this.dataInicialFilter || undefined,
      dataFinal: this.dataFinalFilter || undefined,
      unidades:
        this.selectedUnidades.size > 0
          ? Array.from(this.selectedUnidades)
          : undefined,
    };
    this.orcamentosService.getDashboardOpcoesFiltro(base).subscribe({
      next: (opcoes) => {
        this.opcoesVendedor = opcoes.nomesVendedor;
        this.opcoesMedico = opcoes.medicos;
        this.loadingOpcoesFiltro = false;
        if (this.opcoesFiltroReloadPendente) {
          this.loadOpcoesFiltro(true);
          return;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingOpcoesFiltro = false;
        if (this.opcoesFiltroReloadPendente) {
          this.loadOpcoesFiltro(true);
          return;
        }
        this.cdr.markForCheck();
      },
    });
  }

  private triggerReload(): void {
    this.error = '';
    this.reload$.next();
  }

  private buildAppliedFilters(): void {
    const chips: { key: string; label: string; value: string }[] = [];

    if (this.dataInicialFilter || this.dataFinalFilter) {
      const from = this.dataInicialFilter
        ? this.formatarData(this.dataInicialFilter)
        : '…';
      const to = this.dataFinalFilter
        ? this.formatarData(this.dataFinalFilter)
        : '…';
      chips.push({ key: 'data', label: 'Período', value: `${from} — ${to}` });
    }

    if (this.selectedUnidades.size > 0) {
      chips.push({
        key: 'unidade',
        label: 'Unidade',
        value: Array.from(this.selectedUnidades).join(', '),
      });
    }

    if (this.selectedVendedores.size > 0) {
      chips.push({
        key: 'vendedor',
        label: 'Vendedor',
        value: Array.from(this.selectedVendedores).join(', '),
      });
    }

    if (this.selectedMedicos.size > 0) {
      chips.push({
        key: 'medico',
        label: 'Médico',
        value: Array.from(this.selectedMedicos).join(', '),
      });
    }

    this.appliedFilters = chips;
  }

  private applyFiltersAutomatically(refreshOptions = false): void {
    this.buildAppliedFilters();
    this.triggerReload();
    this.cdr.markForCheck();
    if (refreshOptions) {
      this.loadOpcoesFiltro(true);
    }
  }

  getEvolucaoItens(dados: OrcamentosDashboardIndicadores): Array<{
    periodo: string;
    aprovado: number;
    rejeitado: number;
  }> {
    const labels = dados.evolucaoTemporal.labels;
    const aprovadoSerie = dados.evolucaoTemporal.series[0]?.data ?? [];
    const rejeitadoSerie = dados.evolucaoTemporal.series[1]?.data ?? [];
    const itens = labels.map((periodo, index) => ({
      periodo,
      aprovado: aprovadoSerie[index] ?? 0,
      rejeitado: rejeitadoSerie[index] ?? 0,
    }));
    return itens.slice(-24);
  }

  getEvolucaoMax(
    itens: Array<{ aprovado: number; rejeitado: number }>,
  ): number {
    let max = 0;
    for (const item of itens) {
      if (item.aprovado > max) max = item.aprovado;
      if (item.rejeitado > max) max = item.rejeitado;
    }
    return max > 0 ? max : 1;
  }

  getEvolucaoAprovadoValores(
    itens: Array<{ aprovado: number }>,
  ): number[] {
    return itens.map((i) => i.aprovado);
  }

  getEvolucaoRejeitadoValores(
    itens: Array<{ rejeitado: number }>,
  ): number[] {
    return itens.map((i) => i.rejeitado);
  }

  getEvolucaoPolyline(
    values: number[],
    max: number,
    width = 760,
    height = 220,
    padding = 16,
  ): string {
    if (!values.length) return '';
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    const lastIdx = Math.max(values.length - 1, 1);
    return values
      .map((v, idx) => {
        const x = padding + (idx / lastIdx) * plotWidth;
        const y = padding + (1 - v / max) * plotHeight;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }

  getMaxNumero(values: number[]): number {
    let max = 0;
    for (const v of values) {
      if (v > max) max = v;
    }
    return max > 0 ? max : 1;
  }

  getPercentualBarra(valor: number, max: number): number {
    if (!max || max <= 0) return 0;
    const pct = (valor / max) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  getPerformanceOrdenadosPorColuna<
    T extends Pick<
      DashboardVendedorDetalhe,
      'quantidadeTotal' | 'quantidadeAprovada' | 'quantidadeRejeitada' | 'taxaConversao'
    >,
  >(
    detalhes: T[],
    coluna: keyof Pick<
      DashboardVendedorDetalhe,
      'quantidadeTotal' | 'quantidadeAprovada' | 'quantidadeRejeitada' | 'taxaConversao'
    >,
    limite?: number,
    ocultarValoresZerados = false,
  ): T[] {
    const base = ocultarValoresZerados
      ? detalhes.filter((item) => Number(item[coluna]) > 0)
      : detalhes;
    const ordenados = [...base].sort((a, b) => b[coluna] - a[coluna]);
    if (!limite || limite <= 0) {
      return ordenados;
    }
    return ordenados.slice(0, Math.min(limite, ordenados.length));
  }

  getMaxPerformanceColuna<
    T extends Pick<
      DashboardVendedorDetalhe,
      'quantidadeTotal' | 'quantidadeAprovada' | 'quantidadeRejeitada' | 'taxaConversao'
    >,
  >(
    detalhes: T[],
    coluna: keyof Pick<
      DashboardVendedorDetalhe,
      'quantidadeTotal' | 'quantidadeAprovada' | 'quantidadeRejeitada' | 'taxaConversao'
    >,
    limite?: number,
    ocultarValoresZerados = false,
  ): number {
    const itens = this.getPerformanceOrdenadosPorColuna(
      detalhes,
      coluna,
      limite,
      ocultarValoresZerados,
    );
    return this.getMaxNumero(itens.map((item) => item[coluna]));
  }

  getLimitePerformanceMedico(
    performance: Pick<DashboardPerformanceMedico, 'top' | 'detalhes'>,
  ): number {
    const topMaximo = performance.top > 0 ? performance.top : 20;
    return Math.min(topMaximo, performance.detalhes.length);
  }

  formatarValorColunaPerformance(
    item: Pick<
      DashboardVendedorDetalhe,
      'quantidadeTotal' | 'quantidadeAprovada' | 'quantidadeRejeitada' | 'taxaConversao'
    >,
    coluna: (typeof this.performanceMetricColunas)[number],
  ): string {
    const valor = item[coluna.key];
    return coluna.formato === 'percentual'
      ? this.formatarPercentual(valor)
      : this.formatarInteiro(valor);
  }

  formatarNomeVendedorResumo(valor: string | null): string {
    return this.formatarNomeComUnidadeResumo(valor, 'Sem vendedor');
  }

  formatarNomeMedicoResumo(valor: string | null): string {
    return this.formatarNomeComUnidadeResumo(valor, 'Sem médico');
  }

  private formatarNomeComUnidadeResumo(
    valor: string | null,
    fallback: string,
  ): string {
    const texto = (valor ?? '').trim();
    if (!texto) return fallback;

    let nome = texto;
    let unidade = '';

    for (const u of this.unidades) {
      const sufixo = ` - ${u}`;
      if (texto.endsWith(sufixo)) {
        nome = texto.slice(0, -sufixo.length).trim();
        unidade = u;
        break;
      }
    }

    if (!unidade) {
      const separador = texto.lastIndexOf(' - ');
      if (separador > 0) {
        nome = texto.slice(0, separador).trim();
        unidade = texto.slice(separador + 3).trim();
      }
    }

    const partes = nome.split(/\s+/).filter(Boolean);
    const nomeCurto = partes.slice(0, 2).join(' ') || nome;

    return unidade ? `${nomeCurto} - ${unidade}` : nomeCurto;
  }

  getMaxValorPerdidoPareto(
    itens: Array<{ valorPerdido: number }>,
  ): number {
    return this.getMaxNumero(itens.map((i) => i.valorPerdido));
  }

  getMaxQuantidadePareto(
    itens: Array<{ quantidade: number }>,
  ): number {
    return this.getMaxNumero(itens.map((i) => i.quantidade));
  }

  getParetoBarClass(item: DashboardParetoItem): string {
    const chave = item.motivoRejeicaoId ?? item.descricao;
    let indice = 0;
    for (let i = 0; i < chave.length; i++) {
      indice = (indice + chave.charCodeAt(i) * (i + 3)) % this.paretoBarClasses.length;
    }
    return this.paretoBarClasses[indice];
  }

  trackByFiltro(_: number, item: { key: string; value: string }): string {
    return `${item.key}:${item.value}`;
  }

  trackByNome(_: number, item: string): string {
    return item;
  }

  trackByVendedor(
    _: number,
    item: { nomeVendedor: string | null },
  ): string {
    return item.nomeVendedor ?? 'sem-vendedor';
  }

  trackByUnidade(
    _: number,
    item: DashboardUnidadePerformanceDetalhe,
  ): string {
    return item.unidade;
  }

  trackByColunaPerformance(
    _: number,
    coluna: (typeof this.performanceMetricColunas)[number],
  ): string {
    return coluna.key;
  }

  trackByMedico(
    _: number,
    item: { nomeMedico: string | null },
  ): string {
    return item.nomeMedico ?? 'sem-medico';
  }

  trackByPareto(
    _: number,
    item: { motivoRejeicaoId: string | null; descricao: string },
  ): string {
    return item.motivoRejeicaoId ?? `sem-id:${item.descricao}`;
  }
}
