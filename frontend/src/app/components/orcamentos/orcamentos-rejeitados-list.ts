import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, interval, forkJoin } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { OrcamentosService } from '../../services/orcamentos.service';
import { AuthService } from '../../services/auth.service';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { SincronizacaoService } from '../../services/sincronizacao.service';
import { GlobalBlockingOverlayService } from '../../services/global-blocking-overlay.service';
import {
  Orcamento,
  OrcamentoMotivoRejeicao,
  FindOrcamentosDto,
  OrcamentoMedicoOpcaoFiltro,
  OrcamentoListaStatusFiltro,
  OrcamentoStatus,
} from '../../models/orcamento.model';
import { SincronizacaoProgress } from '../../models/sincronizacao.model';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  DateRangeFilterComponent,
  DateRangeValue,
} from '../date-range-filter/date-range-filter';
import { OrcamentosRejeitadosMedicoFiltroComponent } from './orcamentos-rejeitados-medico-filtro';
import { environment } from '../../../environments/environment';

type SortDirection = 'asc' | 'desc';
type SortableField =
  | 'dataOrcamento'
  | 'nrOrcamento'
  | 'nomeCliente'
  | 'nomeVendedor'
  | 'nomeMedico'
  | 'unidade'
  | 'precoCobrado'
  | 'status';

type OrcamentosRelatorioTipo = 'analitico' | 'sintetico';
type OrcamentosAgrupamentoSecundario =
  | 'nenhum'
  | 'vendedor'
  | 'medico'
  | 'motivo';

type OrcamentosAgrupamentoData = 'todos' | 'ano' | 'mes' | 'dia';
type OrcamentosAgrupamentoTipo = 'todos' | 'aprovado' | 'rejeitado';

type ReportColuna =
  | 'indice'
  | 'nrOrcamento'
  | 'data'
  | 'cliente'
  | 'vendedor'
  | 'medico'
  | 'tipo'
  | 'precoCobrado'
  | 'motivo'
  | 'observacao';

interface OrcamentosRelatorioOpcoes {
  tipo: OrcamentosRelatorioTipo;
  agrupamentoSecundario: OrcamentosAgrupamentoSecundario;
  agrupamentoData: OrcamentosAgrupamentoData;
  agrupamentoTipo: OrcamentosAgrupamentoTipo;
}

@Component({
  selector: 'app-orcamentos-rejeitados-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DateRangeFilterComponent,
    OrcamentosRejeitadosMedicoFiltroComponent,
  ],
  templateUrl: './orcamentos-rejeitados-list.html',
  styleUrls: ['../vendas-list/vendas-list.css', './orcamentos-rejeitados-list.css'],
  encapsulation: ViewEncapsulation.None,
})
export class OrcamentosRejeitadosListComponent implements OnInit, OnDestroy {
  private orcamentosService = inject(OrcamentosService);
  private authService = inject(AuthService);
  private pageContextService = inject(PageContextService);
  private errorModalService = inject(ErrorModalService);
  private sincronizacaoService = inject(SincronizacaoService);
  private globalBlocking = inject(GlobalBlockingOverlayService);
  private syncProgressSubscription?: Subscription;

  Permission = Permission;

  items: Orcamento[] = [];
  motivos: OrcamentoMotivoRejeicao[] = [];
  loading = false;
  printLoading = false;
  error = '';

  currentPage = 1;
  pageSize = 200;
  totalItems = 0;
  totalPages = 0;

  nrOrcamentoFilter = '';
  nomeClienteFilter = '';
  nomeVendedorFilter = '';
  unidadeFilter: Unidade | '' = '';
  /** '' = todos; 'sem' = sem motivo; UUID = motivo do cadastro */
  motivoRejeicaoFilter = '';
  statusFilter: OrcamentoListaStatusFiltro = 'REJEITADO';
  dataInicialFilter = '';
  dataFinalFilter = '';
  unidades = Object.values(Unidade);
  unidadeDisabled = false;

  filtersPanelOpen = false;
  appliedFilters: { key: string; label: string; value: string }[] = [];

  opcoesMedico: OrcamentoMedicoOpcaoFiltro[] = [];
  loadingOpcoesMedico = false;
  selectedMedicos = new Set<string>();

  selectedIds = new Set<string>();
  sortField: SortableField = 'dataOrcamento';
  sortDirection: SortDirection = 'desc';

  showMotivoModal = false;
  modalMotivoId = '';
  modalObservacao = '';
  modalSubmitting = false;

  showPrintModal = false;
  printTipoRelatorio: OrcamentosRelatorioTipo = 'analitico';
  printAgrupamentoSecundario: OrcamentosAgrupamentoSecundario = 'nenhum';
  printAgrupamentoData: OrcamentosAgrupamentoData = 'todos';
  printAgrupamentoTipo: OrcamentosAgrupamentoTipo = 'todos';

  readonly printAgrupamentoDataOpcoes: {
    value: OrcamentosAgrupamentoData;
    label: string;
  }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'ano', label: 'Ano' },
    { value: 'mes', label: 'Mês' },
    { value: 'dia', label: 'Dia' },
  ];

  syncOrcamentosExecutando = false;
  syncProgress: SincronizacaoProgress | null = null;
  syncStatusMensagem = '';

  ngOnInit(): void {
    if (!this.canReadAny()) {
      this.error = 'Você não possui permissão para visualizar orçamentos.';
      return;
    }
    this.initializeStatusFilter();
    this.initializeUnidadeFilter();
    this.initializeDateFilters();
    this.buildAppliedFilters();
    this.pageContextService.setContext({
      title: 'Orçamentos',
      description:
        'Consulte orçamentos aprovados e rejeitados. Registre motivos de rejeição quando aplicável.',
    });
    if (this.canReadRejeitados()) {
      this.loadMotivos();
    }
    this.loadItems();
    this.verificarSyncEmAndamento();
  }

  ngOnDestroy(): void {
    this.pararPollingSync();
    if (this.syncOrcamentosExecutando) {
      this.globalBlocking.hide();
    }
  }

  private verificarSyncEmAndamento(): void {
    if (!this.canSync()) return;
    this.sincronizacaoService.getStatus().subscribe({
      next: (status) => {
        if (status.emExecucao) {
          this.syncOrcamentosExecutando = true;
          this.syncProgress = status.progresso;
          this.syncStatusMensagem =
            status.progresso?.message ?? 'Atualizando orçamentos...';
          this.mostrarBlockingSync();
          this.iniciarPollingSync();
        }
      },
      error: () => {},
    });
  }

  private mostrarBlockingSync(): void {
    const progress = this.syncProgress;
    const orcTotal = progress?.orcamentosTotal ?? 0;
    const orcAtual = progress?.orcamentosAtual ?? 0;
    const progressTotal = orcTotal > 0 ? orcTotal : 100;
    const progressCurrent =
      orcTotal > 0 ? orcAtual : this.getSyncProgressPercent();

    this.globalBlocking.show({
      title: 'Atualizando orçamentos',
      message: this.syncStatusMensagem || 'Processando...',
      note:
        'Aguarde a conclusão. O acesso ao sistema permanece bloqueado durante a atualização.',
      progressCurrent,
      progressTotal,
      progressLabel: progress?.agenteAtual
        ? `Agente: ${progress.agenteAtual}`
        : this.getSyncOrcamentosLabel(),
    });
  }

  /** Segunda: intervalo D-2 até hoje; demais dias: D-1 até hoje (data local). */
  private initializeDateFilters(): void {
    if (this.dataInicialFilter && this.dataFinalFilter) {
      return;
    }
    const now = new Date();
    const daysBack = now.getDay() === 1 ? 2 : 1;
    const start = new Date(now);
    start.setDate(start.getDate() - daysBack);
    this.dataInicialFilter = this.formatDateLocal(start);
    this.dataFinalFilter = this.formatDateLocal(now);
  }

  private formatDateLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  canReadAny(): boolean {
    return this.canReadRejeitados() || this.canReadAprovados();
  }

  canReadRejeitados(): boolean {
    return this.authService.hasPermission(Permission.ORCAMENTO_REJEITADO_READ);
  }

  canReadAprovados(): boolean {
    return this.authService.hasPermission(Permission.ORCAMENTO_APROVADO_READ);
  }

  canViewValores(): boolean {
    return this.authService.hasPermission(Permission.ORCAMENTO_VIEW_VALORES);
  }

  canPrint(): boolean {
    return this.authService.hasPermission(Permission.ORCAMENTO_PRINT);
  }

  canUpdate(): boolean {
    return this.authService.hasPermission(Permission.ORCAMENTO_REJEITADO_UPDATE);
  }

  canSync(): boolean {
    return this.authService.hasPermission(Permission.ORCAMENTO_REJEITADO_SYNC);
  }

  showStatusFilterOptions(): boolean {
    return this.canReadRejeitados() && this.canReadAprovados();
  }

  exibirColunasRejeitado(): boolean {
    return this.canReadRejeitados() && this.statusFilter !== 'APROVADO';
  }

  exibirLegendaMotivo(): boolean {
    return this.exibirColunasRejeitado() && this.canUpdate();
  }

  exibirLegendaAprovado(): boolean {
    return this.canReadAprovados() && this.statusFilter !== 'REJEITADO';
  }

  exibirLegenda(): boolean {
    return this.exibirLegendaMotivo() || this.exibirLegendaAprovado();
  }

  isSelecionavel(item: Orcamento): boolean {
    return (
      this.exibirCheckboxSelecao() &&
      item.status === OrcamentoStatus.REJEITADO
    );
  }

  exibirColunaTipo(): boolean {
    return this.statusFilter === 'TODOS';
  }

  exibirCheckboxSelecao(): boolean {
    return this.exibirColunasRejeitado() && this.canUpdate();
  }

  get printAgrupamentoSecundarioOpcoes(): {
    value: OrcamentosAgrupamentoSecundario;
    label: string;
  }[] {
    const opcoes: { value: OrcamentosAgrupamentoSecundario; label: string }[] = [
      { value: 'nenhum', label: 'Sem agrupamento' },
      { value: 'vendedor', label: 'Vendedor' },
      { value: 'medico', label: 'Médico' },
    ];
    if (this.permiteMotivoNoRelatorio()) {
      opcoes.push({ value: 'motivo', label: 'Motivo' });
    }
    return opcoes;
  }

  onPrintAgrupamentoTipoChange(): void {
    if (
      this.printAgrupamentoTipo === 'aprovado' &&
      this.printAgrupamentoSecundario === 'motivo'
    ) {
      this.printAgrupamentoSecundario = 'nenhum';
    }
  }

  private permiteMotivoNoRelatorio(): boolean {
    return (
      this.canReadRejeitados() && this.printAgrupamentoTipo !== 'aprovado'
    );
  }

  get printAgrupamentoTipoOpcoes(): {
    value: OrcamentosAgrupamentoTipo;
    label: string;
  }[] {
    const opcoes: { value: OrcamentosAgrupamentoTipo; label: string }[] = [];
    if (this.showStatusFilterOptions()) {
      opcoes.push({ value: 'todos', label: 'Todos' });
    }
    if (this.canReadAprovados()) {
      opcoes.push({ value: 'aprovado', label: 'Aprovados' });
    }
    if (this.canReadRejeitados()) {
      opcoes.push({ value: 'rejeitado', label: 'Rejeitados' });
    }
    return opcoes;
  }

  showPrintAgrupamentoTipoOptions(): boolean {
    return this.printAgrupamentoTipoOpcoes.length > 1;
  }

  private resolvePrintStatusFiltro(): OrcamentoListaStatusFiltro {
    if (this.printAgrupamentoTipo === 'aprovado') {
      return 'APROVADO';
    }
    if (this.printAgrupamentoTipo === 'rejeitado') {
      return 'REJEITADO';
    }
    if (this.canReadAprovados() && this.canReadRejeitados()) {
      return 'TODOS';
    }
    if (this.canReadAprovados()) {
      return 'APROVADO';
    }
    return 'REJEITADO';
  }

  private statusFiltroParaAgrupamentoTipo(
    status: OrcamentoListaStatusFiltro,
  ): OrcamentosAgrupamentoTipo {
    if (status === 'APROVADO') return 'aprovado';
    if (status === 'REJEITADO') return 'rejeitado';
    return 'todos';
  }

  private initializeStatusFilter(): void {
    if (this.canReadRejeitados() && this.canReadAprovados()) {
      this.statusFilter = 'TODOS';
    } else if (this.canReadAprovados()) {
      this.statusFilter = 'APROVADO';
    } else {
      this.statusFilter = 'REJEITADO';
    }
  }

  onStatusFilterChange(): void {
    if (this.statusFilter === 'APROVADO') {
      this.motivoRejeicaoFilter = '';
      this.selectedIds.clear();
    }
    if (
      this.printAgrupamentoSecundario === 'motivo' &&
      !this.exibirColunasRejeitado()
    ) {
      this.printAgrupamentoSecundario = 'nenhum';
    }
    this.currentPage = 1;
    this.buildAppliedFilters();
    this.loadItems();
  }

  getStatusFilterLabel(status: OrcamentoListaStatusFiltro): string {
    const labels: Record<OrcamentoListaStatusFiltro, string> = {
      APROVADO: 'Aprovados',
      REJEITADO: 'Rejeitados',
      TODOS: 'Todos',
    };
    return labels[status];
  }

  atualizarOrcamentos(): void {
    if (!this.canSync() || this.syncOrcamentosExecutando) return;

    this.syncOrcamentosExecutando = true;
    this.syncProgress = null;
    this.syncStatusMensagem = 'Iniciando atualização de orçamentos...';
    this.mostrarBlockingSync();
    this.iniciarPollingSync();

    this.sincronizacaoService.executarSincronizacaoOrcamentos().subscribe({
      next: (resultados) => {
        this.syncOrcamentosExecutando = false;
        this.pararPollingSync(true);
        const total = resultados.reduce(
          (sum, r) => sum + r.orcamentosProcessados,
          0,
        );
        const erros = resultados.flatMap((r) => r.erros);
        const message =
          erros.length > 0
            ? `Atualização concluída com ${erros.length} aviso(s). ${total} orçamento(s) processado(s).`
            : `${total} orçamento(s) processado(s) com sucesso.`;
        this.globalBlocking.complete({
          title: 'Atualização concluída',
          message,
          dismissButtonLabel: 'Concluir atualização',
        });
        this.loadItems();
      },
      error: (err) => {
        this.syncOrcamentosExecutando = false;
        this.pararPollingSync(true);
        const msg =
          err?.status === 409
            ? 'Já existe uma sincronização em andamento. Aguarde a conclusão.'
            : err?.error?.message ?? 'Erro ao atualizar orçamentos.';
        this.globalBlocking.complete({
          title: 'Erro na atualização',
          message: msg,
          dismissButtonLabel: 'Concluir atualização',
        });
      },
    });
  }

  private iniciarPollingSync(): void {
    this.pararPollingSync();
    this.syncProgressSubscription = interval(500)
      .pipe(
        switchMap(() => this.sincronizacaoService.getProgresso()),
        takeWhile(() => this.syncOrcamentosExecutando, true),
      )
      .subscribe({
        next: (progress) => {
          if (!progress) return;
          this.syncProgress = progress;
          this.syncStatusMensagem = progress.message;
          if (this.syncOrcamentosExecutando) {
            this.mostrarBlockingSync();
          }
        },
        error: () => {},
      });
  }

  private pararPollingSync(finalFetch = false): void {
    this.syncProgressSubscription?.unsubscribe();
    this.syncProgressSubscription = undefined;
    if (finalFetch) {
      this.sincronizacaoService.getProgresso().subscribe({
        next: (progress) => {
          if (progress) {
            this.syncProgress = progress;
            this.syncStatusMensagem = progress.message;
            // Evita reabrir o modal em modo "processing" depois do complete().
            if (this.syncOrcamentosExecutando && progress.status === 'running') {
              this.mostrarBlockingSync();
            }
          }
        },
      });
    }
  }

  getSyncProgressPercent(): number {
    if (!this.syncProgress) return 0;
    if (this.syncProgress.percentualOrcamentos > 0) {
      return this.syncProgress.percentualOrcamentos;
    }
    return this.syncProgress.percentual ?? 0;
  }

  getSyncOrcamentosLabel(): string {
    if (!this.syncProgress) return '';
    const atual = this.syncProgress.orcamentosAtual;
    const total = this.syncProgress.orcamentosTotal;
    if (total > 0) {
      return `${atual}/${total} orçamentos`;
    }
    return '';
  }

  private initializeUnidadeFilter(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.unidade && String(currentUser.unidade).trim() !== '') {
      this.unidadeFilter = currentUser.unidade as Unidade;
      this.unidadeDisabled = true;
    }
  }

  private loadMotivos(): void {
    this.orcamentosService.listarMotivos(true).subscribe({
      next: (m) => {
        this.motivos = m;
        if (this.motivoRejeicaoFilter && this.motivoRejeicaoFilter !== 'sem') {
          this.buildAppliedFilters();
        }
      },
      error: () => {},
    });
  }

  loadItems(): void {
    if (!this.canReadAny()) return;
    this.loading = true;
    this.error = '';

    this.orcamentosService
      .listarOrcamentos(this.buildOrcamentosFilters(this.currentPage, this.pageSize))
      .subscribe({
      next: (res) => {
        this.items = res.data;
        this.totalItems = res.meta.total;
        this.totalPages = res.meta.totalPages;
        this.currentPage = res.meta.page;
        this.loading = false;
        this.selectedIds.clear();
      },
      error: (e) => {
        this.loading = false;
        this.error = e?.error?.message ?? 'Erro ao carregar orçamentos.';
      },
    });
  }

  private buildOrcamentosFilters(
    page: number,
    limit: number,
    statusOverride?: OrcamentoListaStatusFiltro,
    relatorio = false,
  ): FindOrcamentosDto {
    const filters: FindOrcamentosDto = {
      page,
      limit,
      sortBy: this.sortField,
      sortOrder: this.sortDirection,
      status: statusOverride ?? this.statusFilter,
    };
    if (relatorio) {
      filters.relatorio = true;
    }

    if (this.unidadeFilter) filters.unidade = this.unidadeFilter;
    if (this.nrOrcamentoFilter.trim()) {
      filters.nrOrcamento = this.nrOrcamentoFilter.trim();
    }
    if (this.nomeClienteFilter.trim()) {
      filters.nomeCliente = this.nomeClienteFilter.trim();
    }
    if (this.nomeVendedorFilter.trim()) {
      filters.nomeVendedor = this.nomeVendedorFilter.trim();
    }
    if (this.selectedMedicos.size > 0) {
      filters.nomesMedico = Array.from(this.selectedMedicos);
    }
    if (this.exibirColunasRejeitado()) {
      if (this.motivoRejeicaoFilter === 'sem') {
        filters.comMotivo = false;
      } else if (this.motivoRejeicaoFilter) {
        filters.motivoRejeicaoId = this.motivoRejeicaoFilter;
      }
    }
    if (this.dataInicialFilter) filters.dataInicial = this.dataInicialFilter;
    if (this.dataFinalFilter) filters.dataFinal = this.dataFinalFilter;

    return filters;
  }

  applyFilters(): void {
    this.filtersPanelOpen = false;
    this.currentPage = 1;
    this.buildAppliedFilters();
    this.loadItems();
  }

  clearFilters(): void {
    this.nrOrcamentoFilter = '';
    this.nomeClienteFilter = '';
    this.nomeVendedorFilter = '';
    this.motivoRejeicaoFilter = '';
    this.selectedMedicos.clear();
    this.dataInicialFilter = '';
    this.dataFinalFilter = '';
    this.initializeStatusFilter();
    this.initializeDateFilters();
    if (!this.unidadeDisabled) {
      this.unidadeFilter = '';
    }
    this.filtersPanelOpen = false;
    this.currentPage = 1;
    this.buildAppliedFilters();
    this.loadItems();
  }

  onDataRangeChangeModal(range: DateRangeValue): void {
    this.dataInicialFilter = range.start || '';
    this.dataFinalFilter = range.end || '';
  }

  private buildAppliedFilters(): void {
    const list: { key: string; label: string; value: string }[] = [];
    if (this.showStatusFilterOptions()) {
      list.push({
        key: 'status',
        label: 'Tipo',
        value: this.getStatusFilterLabel(this.statusFilter),
      });
    }
    if (this.unidadeFilter) {
      list.push({ key: 'unidade', label: 'Unidade', value: this.unidadeFilter });
    }
    if (this.nrOrcamentoFilter.trim()) {
      list.push({ key: 'nrOrcamento', label: 'Nº orçamento', value: this.nrOrcamentoFilter.trim() });
    }
    if (this.nomeClienteFilter.trim()) {
      list.push({ key: 'nomeCliente', label: 'Cliente', value: this.nomeClienteFilter.trim() });
    }
    if (this.nomeVendedorFilter.trim()) {
      list.push({ key: 'nomeVendedor', label: 'Vendedor', value: this.nomeVendedorFilter.trim() });
    }
    if (this.selectedMedicos.size > 0) {
      list.push({
        key: 'medico',
        label: 'Médico',
        value: Array.from(this.selectedMedicos).join(', '),
      });
    }
    if (this.exibirColunasRejeitado()) {
      if (this.motivoRejeicaoFilter === 'sem') {
        list.push({
          key: 'motivoRejeicao',
          label: 'Motivo registrado',
          value: 'Sem motivo',
        });
      } else if (this.motivoRejeicaoFilter) {
        list.push({
          key: 'motivoRejeicao',
          label: 'Motivo registrado',
          value: this.getMotivoDescricao(this.motivoRejeicaoFilter),
        });
      }
    }
    if (this.dataInicialFilter || this.dataFinalFilter) {
      if (this.dataInicialFilter && !this.dataFinalFilter) {
        list.push({
          key: 'dataOrcamento',
          label: 'Data do orçamento',
          value: `Maior que ${this.formatarData(this.dataInicialFilter)}`,
        });
      } else {
        const from = this.dataInicialFilter ? this.formatarData(this.dataInicialFilter) : '';
        const to = this.dataFinalFilter ? this.formatarData(this.dataFinalFilter) : '';
        let value = '';
        if (from && to) {
          value = `${from} a ${to}`;
        } else if (from) {
          value = `A partir de ${from}`;
        } else if (to) {
          value = `Até ${to}`;
        }
        list.push({ key: 'dataOrcamento', label: 'Data do orçamento', value });
      }
    }
    this.appliedFilters = list;
  }

  canRemoveFilter(key: string): boolean {
    if (key === 'unidade' && this.unidadeDisabled) {
      return false;
    }
    return true;
  }

  getFilterIcon(key: string): string {
    const icons: Record<string, string> = {
      unidade: 'fa-building',
      nrOrcamento: 'fa-hashtag',
      nomeCliente: 'fa-user',
      nomeVendedor: 'fa-user-tie',
      medico: 'fa-user-md',
      comMotivo: 'fa-tag',
      motivoRejeicao: 'fa-tag',
      status: 'fa-exchange-alt',
      dataOrcamento: 'fa-calendar-alt',
    };
    return icons[key] ?? 'fa-filter';
  }

  formatFilterValue(value: string): string {
    const maxLength = 30;
    if (value.length > maxLength) {
      return `${value.substring(0, maxLength)}...`;
    }
    return value;
  }

  removeFilter(key: string): void {
    switch (key) {
      case 'unidade':
        if (!this.unidadeDisabled) this.unidadeFilter = '';
        break;
      case 'nrOrcamento':
        this.nrOrcamentoFilter = '';
        break;
      case 'nomeCliente':
        this.nomeClienteFilter = '';
        break;
      case 'nomeVendedor':
        this.nomeVendedorFilter = '';
        break;
      case 'medico':
        this.selectedMedicos.clear();
        break;
      case 'status':
        this.initializeStatusFilter();
        break;
      case 'comMotivo':
      case 'motivoRejeicao':
        this.motivoRejeicaoFilter = '';
        break;
      case 'dataOrcamento':
        this.dataInicialFilter = '';
        this.dataFinalFilter = '';
        break;
    }
    this.applyFilters();
  }

  toggleFiltersVisibility(): void {
    const opening = !this.filtersPanelOpen;
    this.filtersPanelOpen = opening;
    if (opening) {
      this.loadOpcoesMedico();
    }
  }

  loadOpcoesMedico(): void {
    this.loadingOpcoesMedico = true;
    this.orcamentosService
      .getOrcamentosOpcoesFiltro({
        unidade: this.unidadeFilter || undefined,
        dataInicial: this.dataInicialFilter || undefined,
        dataFinal: this.dataFinalFilter || undefined,
        status: this.statusFilter,
      })
      .subscribe({
        next: (opcoes) => {
          this.opcoesMedico = opcoes.medicos;
          this.loadingOpcoesMedico = false;
        },
        error: () => {
          this.loadingOpcoesMedico = false;
        },
      });
  }

  onMedicosSelected(medicos: Set<string>): void {
    this.selectedMedicos = medicos;
  }

  onContainerClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target) {
      return;
    }

    const btnToggle = target.closest('.btn-toggle-filtros');
    const chipRemove = target.closest('.chip-remove');
    const btnClearAll = target.closest('.btn-clear-all');
    const resultsCount = target.closest('.results-count');

    if (btnToggle || chipRemove || btnClearAll || resultsCount) {
      return;
    }

    const filterChip = target.closest('.filter-chip');
    if (filterChip && !chipRemove) {
      this.toggleFiltersVisibility();
      return;
    }

    const filtersPanelTop = target.closest('.filters-panel-top');
    if (filtersPanelTop) {
      this.toggleFiltersVisibility();
    }
  }

  onFiltersToggleKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleFiltersVisibility();
    }
  }

  sortBy(field: SortableField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.loadItems();
  }

  getSortIcon(field: SortableField): string {
    if (this.sortField !== field) return 'fa-sort';
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  onRowClick(event: MouseEvent, item: Orcamento): void {
    const target = event.target as HTMLElement;
    if (target.closest('input[type="checkbox"]')) return;
    if (!this.isSelecionavel(item)) return;
    this.toggleSelection(item.id);
  }

  toggleSelection(id: string): void {
    const item = this.items.find((o) => o.id === id);
    if (item && !this.isSelecionavel(item)) {
      return;
    }
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  toggleSelectAll(): void {
    const selecionaveis = this.items.filter((item) => this.isSelecionavel(item));
    const todosMarcados =
      selecionaveis.length > 0 &&
      selecionaveis.every((item) => this.selectedIds.has(item.id));

    if (todosMarcados) {
      this.selectedIds.clear();
      return;
    }

    selecionaveis.forEach((item) => this.selectedIds.add(item.id));
  }

  isAllSelected(): boolean {
    const selecionaveis = this.items.filter((item) => this.isSelecionavel(item));
    return (
      selecionaveis.length > 0 &&
      selecionaveis.every((item) => this.selectedIds.has(item.id))
    );
  }

  isIndeterminate(): boolean {
    const selecionaveis = this.items.filter((item) => this.isSelecionavel(item));
    if (selecionaveis.length === 0) {
      return false;
    }
    const marcados = selecionaveis.filter((item) =>
      this.selectedIds.has(item.id),
    ).length;
    return marcados > 0 && marcados < selecionaveis.length;
  }

  openMotivoModal(): void {
    if (!this.canUpdate() || this.selectedIds.size === 0) return;
    this.modalMotivoId = '';
    this.modalObservacao = '';
    this.showMotivoModal = true;
    this.loadMotivos();
  }

  closeMotivoModal(): void {
    if (this.modalSubmitting) return;
    this.showMotivoModal = false;
  }

  private getIdsSelecionadosRejeitados(): string[] {
    const idsRejeitados = new Set(
      this.items
        .filter((item) => item.status === OrcamentoStatus.REJEITADO)
        .map((item) => item.id),
    );
    return Array.from(this.selectedIds).filter((id) => idsRejeitados.has(id));
  }

  confirmMotivoModal(): void {
    if (!this.modalMotivoId) {
      this.errorModalService.show('Selecione um motivo de rejeição.', 'Validação');
      return;
    }
    const ids = this.getIdsSelecionadosRejeitados();
    if (ids.length === 0) {
      this.errorModalService.show(
        'Selecione apenas orçamentos rejeitados para registrar motivo.',
        'Validação',
      );
      return;
    }
    this.modalSubmitting = true;
    this.orcamentosService
      .atualizarRejeitadosEmMassa({
        ids,
        motivoRejeicaoId: this.modalMotivoId,
        observacaoRejeicao: this.modalObservacao.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.modalSubmitting = false;
          this.showMotivoModal = false;
          this.errorModalService.show(
            `${res.atualizados} orçamento(s) atualizado(s).`,
            'Sucesso',
          );
          this.loadItems();
        },
        error: (e) => {
          this.modalSubmitting = false;
          this.errorModalService.show(
            e?.error?.message ?? 'Erro ao registrar motivo.',
            'Erro',
          );
        },
      });
  }

  private getMotivoDescricao(id: string): string {
    return this.motivos.find((m) => m.id === id)?.descricao ?? id;
  }

  formatarData(data: string | null | undefined): string {
    if (!data) return '—';
    const s = data.includes('T') ? data.split('T')[0] : data.slice(0, 10);
    const [y, m, d] = s.split('-');
    return y && m && d ? `${d}/${m}/${y}` : s;
  }

  formatarMoeda(valor: number | null | undefined): string {
    if (valor === null || valor === undefined) return '—';
    return Number(valor).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  }

  formatarMedico(item: Orcamento): string {
    const partes: string[] = [];
    const nome = item.nomeMedico?.trim();
    if (nome) {
      partes.push(nome);
    }
    const crm = item.crmMedico?.trim();
    const uf = item.ufcrmMedico?.trim();
    if (crm && uf) {
      partes.push(`${crm}-${uf}`);
    } else if (crm) {
      partes.push(crm);
    } else if (uf) {
      partes.push(uf);
    }
    return partes.length ? partes.join(' ') : '—';
  }

  rowClass(item: Orcamento): string {
    const classes = [];
    if (this.isSelected(item.id)) classes.push('row-selected');
    if (item.status === OrcamentoStatus.APROVADO) {
      classes.push('row-aprovado');
    } else if (this.exibirColunasRejeitado()) {
      classes.push(item.motivoRejeicaoId ? 'row-com-motivo' : 'row-sem-motivo');
    }
    if (this.exibirCheckboxSelecao() && !this.isSelecionavel(item)) {
      classes.push('row-nao-selecionavel');
    }
    return classes.join(' ');
  }

  formatarStatus(status: OrcamentoStatus): string {
    return status === OrcamentoStatus.APROVADO ? 'Aprovado' : 'Rejeitado';
  }

  getTableColspan(): number {
    let cols = 6;
    if (this.exibirCheckboxSelecao()) cols += 1;
    if (this.exibirColunaTipo()) cols += 1;
    if (this.canViewValores()) cols += 1;
    if (this.exibirColunasRejeitado()) cols += 2;
    return cols;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadItems();
  }

  imprimirFiltrados(): void {
    this.openPrintModal();
  }

  openPrintModal(): void {
    if (!this.canPrint() || !this.canReadAny()) {
      return;
    }

    if (this.totalItems === 0) {
      this.errorModalService.show(
        'Nenhum orçamento encontrado com os filtros aplicados.',
        'Aviso',
      );
      return;
    }

    this.printTipoRelatorio = 'analitico';
    this.printAgrupamentoSecundario = 'nenhum';
    this.printAgrupamentoData = 'todos';
    this.printAgrupamentoTipo = this.statusFiltroParaAgrupamentoTipo(
      this.statusFilter,
    );
    this.showPrintModal = true;
  }

  closePrintModal(): void {
    if (this.printLoading) {
      return;
    }
    this.showPrintModal = false;
  }

  confirmGerarRelatorio(): void {
    if (!this.canPrint() || !this.canReadAny() || this.totalItems === 0) {
      return;
    }

    const opcoes = this.getPrintModalOpcoes();
    this.showPrintModal = false;

    const popup = window.open('', '_blank', 'width=1024,height=768');
    if (!popup) {
      this.errorModalService.show(
        'Não foi possível abrir a janela de impressão. Verifique bloqueadores de pop-up.',
        'Erro',
      );
      return;
    }

    this.printLoading = true;
    this.loadAllOrcamentosForReport(
      (registros) => {
        this.printLoading = false;
        if (registros.length === 0) {
          popup.close();
          this.errorModalService.show(
            'Nenhum orçamento encontrado com os filtros aplicados.',
            'Aviso',
          );
          return;
        }
        this.writeOrcamentosReport(popup, registros, opcoes);
      },
      () => {
        this.printLoading = false;
        popup.close();
        this.errorModalService.show(
          'Erro ao carregar dados para impressão.',
          'Erro',
        );
      },
    );
  }

  private getPrintModalOpcoes(): OrcamentosRelatorioOpcoes {
    return {
      tipo: this.printTipoRelatorio,
      agrupamentoSecundario: this.printAgrupamentoSecundario,
      agrupamentoData: this.printAgrupamentoData,
      agrupamentoTipo: this.printAgrupamentoTipo,
    };
  }

  private loadAllOrcamentosForReport(
    onComplete: (items: Orcamento[]) => void,
    onError: () => void,
  ): void {
    const limit = 200;
    const printStatus = this.resolvePrintStatusFiltro();
    this.orcamentosService
      .listarOrcamentosRelatorio(this.buildOrcamentosFilters(1, limit, printStatus, true))
      .subscribe({
        next: (first) => {
          const all = [...first.data];
          const totalPages = first.meta.totalPages ?? 1;
          if (totalPages <= 1) {
            onComplete(all);
            return;
          }

          const requests = [];
          for (let page = 2; page <= totalPages; page++) {
            requests.push(
              this.orcamentosService.listarOrcamentosRelatorio(
                this.buildOrcamentosFilters(page, limit, printStatus, true),
              ),
            );
          }

          forkJoin(requests).subscribe({
            next: (pages) => {
              pages.forEach((response) => all.push(...response.data));
              onComplete(all);
            },
            error: onError,
          });
        },
        error: onError,
      });
  }

  private writeOrcamentosReport(
    popup: Window,
    registros: Orcamento[],
    opcoes: OrcamentosRelatorioOpcoes,
  ): void {
    const reportTitle = 'Orçamentos';
    const reportTimestamp = this.getReportTimestamp();
    const currentUser = this.authService.getCurrentUser();
    const usuarioLabel =
      currentUser?.nome || currentUser?.email || 'Usuário não identificado';
    const agora = new Date();
    const geradoEm = `Gerado em ${agora.toLocaleDateString('pt-BR')}, ${agora.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })} por ${usuarioLabel}`;

    const logoUrl = `${environment.apiUrl}/configuracao/logo`;
    const logoHtml = `<img src="${logoUrl}" alt="Logo do sistema" onerror="this.style.display='none'" />`;

    const filtrosHtml =
      this.appliedFilters.length > 0
        ? `<div class="subheader filtros"><strong>Filtros aplicados:</strong> ${this.appliedFilters
            .map(
              (filtro) =>
                `${this.escapeHtml(filtro.label)}: ${this.escapeHtml(filtro.value)}`,
            )
            .join(' | ')}</div>`
        : '';

    const parametrosHtml = this.formatOpcoesRelatorioHtml(opcoes);
    const contador = { n: 0 };
    const corpoRelatorio = this.buildReportSections(registros, opcoes, contador);

    const totalPreco = registros.reduce(
      (total, item) => total + (Number(item.precoCobrado) || 0),
      0,
    );

    popup.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${reportTitle} ${reportTimestamp}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 16px; color: #1f2937; background: #fff; font-size: 12px; }
            h1 { margin: 0; font-size: 20px; letter-spacing: 0.5px; color: #0f172a; }
            h2.group-title { margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.03em; }
            h3.subgroup-title { margin: 12px 0 6px; font-size: 12px; font-weight: 700; color: #334155; }
            .print-actions { text-align: right; margin-bottom: 12px; }
            .print-actions button { padding: 8px 16px; border: none; background: #2563eb; color: #fff; border-radius: 4px; cursor: pointer; font-size: 12px; }
            .report-header { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }
            .logo-area { flex: 0 0 200px; display: flex; justify-content: flex-start; align-items: center; }
            .logo-area img { max-height: 60px; width: auto; display: block; }
            .title-area { flex: 1; text-align: center; }
            .subheader { color: #64748b; font-size: 12px; margin-top: 4px; }
            .filtros, .parametros { margin-top: 8px; line-height: 1.4; }
            .report-group { margin-top: 18px; page-break-inside: avoid; }
            .report-subgroup { margin-top: 10px; margin-left: 12px; }
            .table-wrapper { border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; margin-top: 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; }
            tr:last-child td { border-bottom: none; }
            th { background-color: #f8fafc; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; color: #475569; }
            tfoot td { background-color: #f8fafc; font-weight: 700; color: #0f172a; border-top: 2px solid #cbd5e1; }
            .group-summary { margin-top: 8px; text-align: right; font-weight: 600; color: #334155; font-size: 11px; }
            .group-summary.subtotal { color: #475569; }
            .group-summary.total-unidade { margin-top: 12px; font-size: 12px; color: #0f172a; }
            .sintetico-total-unidade { margin-top: 4px; font-size: 12px; font-weight: 700; color: #0f172a; }
            .summary { margin-top: 16px; text-align: right; font-weight: 700; color: #0f172a; }
            @media print { .print-actions { display: none; } body { margin: 0 20px 80px; } }
          </style>
        </head>
        <body>
          <div class="print-actions">
            <button type="button" onclick="window.print()">Imprimir PDF</button>
          </div>
          <div class="report-header">
            <div class="logo-area">${logoHtml}</div>
            <div class="title-area">
              <h1>${reportTitle}</h1>
              <div class="subheader">${geradoEm}</div>
              ${filtrosHtml}
              ${parametrosHtml}
            </div>
          </div>
          ${corpoRelatorio}
          <div class="summary">
            Total no filtro: ${registros.length} registro(s)${this.canViewValores() ? ` | Soma valor: ${this.escapeHtml(this.formatarMoeda(totalPreco))}` : ''}
          </div>
        </body>
      </html>
    `);
    popup.document.close();
  }

  private formatOpcoesRelatorioHtml(opcoes: OrcamentosRelatorioOpcoes): string {
    const tipo =
      opcoes.tipo === 'analitico' ? 'Analítico' : 'Sintético';
    const agrupamentoSecundario = this.getAgrupamentoSecundarioLabel(
      opcoes.agrupamentoSecundario,
    );
    const partesQuebra = ['Unidade'];
    if (opcoes.agrupamentoTipo === 'todos' && this.showStatusFilterOptions()) {
      partesQuebra.push('Tipo');
    } else if (opcoes.agrupamentoTipo === 'aprovado') {
      partesQuebra.push('Aprovados');
    } else if (opcoes.agrupamentoTipo === 'rejeitado') {
      partesQuebra.push('Rejeitados');
    }
    if (opcoes.agrupamentoData !== 'todos') {
      partesQuebra.push(this.getAgrupamentoDataLabel(opcoes.agrupamentoData));
    }
    if (opcoes.agrupamentoSecundario !== 'nenhum') {
      partesQuebra.push(agrupamentoSecundario);
    } else if (
      opcoes.agrupamentoData === 'todos' &&
      opcoes.agrupamentoTipo !== 'todos'
    ) {
      partesQuebra.push('Sem agrupamento');
    }
    return `<div class="subheader parametros"><strong>Parâmetros:</strong> Tipo: ${tipo} | Quebra: ${partesQuebra.map((p) => this.escapeHtml(p)).join(' → ')}</div>`;
  }

  private buildReportSections(
    registros: Orcamento[],
    opcoes: OrcamentosRelatorioOpcoes,
    contador: { n: number },
  ): string {
    const porUnidade = this.agruparRegistrosPor(
      registros,
      (item) => item.unidade || 'Não informado',
    );

    return Array.from(porUnidade.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([unidade, itensUnidade]) =>
        this.buildSecaoUnidade(unidade, itensUnidade, opcoes, contador),
      )
      .join('');
  }

  private buildSecaoUnidade(
    unidade: string,
    itens: Orcamento[],
    opcoes: OrcamentosRelatorioOpcoes,
    contador: { n: number },
  ): string {
    const conteudo = this.buildConteudoEmCamadas(itens, opcoes, contador);

    const totalUnidadeHtml =
      opcoes.tipo === 'analitico'
        ? this.buildTotaisHtml(itens, 'Total da unidade', 'total-unidade')
        : '';

    return `
      <section class="report-group">
        <h2 class="group-title">Unidade: ${this.escapeHtml(unidade)}</h2>
        ${conteudo}
        ${totalUnidadeHtml}
      </section>
    `;
  }

  private buildConteudoEmCamadas(
    itens: Orcamento[],
    opcoes: OrcamentosRelatorioOpcoes,
    contador: { n: number },
  ): string {
    if (
      opcoes.agrupamentoTipo === 'todos' &&
      this.possuiAmbosStatus(itens)
    ) {
      const grupos = this.agruparRegistrosPor(itens, (item) => item.status);
      const ordemStatus = [OrcamentoStatus.APROVADO, OrcamentoStatus.REJEITADO];

      return ordemStatus
        .filter((status) => grupos.has(status))
        .map((status) => {
          const itensTipo = grupos.get(status) ?? [];
          const rotulo = this.formatarStatus(status);
          const conteudo = this.buildConteudoAposTipo(
            itensTipo,
            opcoes,
            contador,
          );
          const subtotalHtml =
            opcoes.tipo === 'analitico'
              ? this.buildTotaisHtml(
                  itensTipo,
                  `Subtotal Tipo (${rotulo})`,
                  'subtotal',
                )
              : '';
          return `
            <section class="report-subgroup report-subgroup-tipo">
              <h3 class="subgroup-title">Tipo: ${this.escapeHtml(rotulo)}</h3>
              ${conteudo}
              ${subtotalHtml}
            </section>
          `;
        })
        .join('');
    }

    return this.buildConteudoAposTipo(itens, opcoes, contador);
  }

  private buildConteudoAposTipo(
    itens: Orcamento[],
    opcoes: OrcamentosRelatorioOpcoes,
    contador: { n: number },
  ): string {
    if (opcoes.agrupamentoData !== 'todos') {
      return this.buildConteudoComQuebraData(itens, opcoes, contador);
    }
    return this.buildConteudoRelatorio(itens, opcoes, contador);
  }

  private possuiAmbosStatus(itens: Orcamento[]): boolean {
    let temAprovado = false;
    let temRejeitado = false;
    for (const item of itens) {
      if (item.status === OrcamentoStatus.APROVADO) {
        temAprovado = true;
      } else if (item.status === OrcamentoStatus.REJEITADO) {
        temRejeitado = true;
      }
      if (temAprovado && temRejeitado) {
        return true;
      }
    }
    return false;
  }

  private buildConteudoRelatorio(
    itens: Orcamento[],
    opcoes: OrcamentosRelatorioOpcoes,
    contador: { n: number },
  ): string {
    return opcoes.tipo === 'sintetico'
      ? this.buildConteudoSintetico(itens, opcoes)
      : this.buildConteudoAnalitico(itens, opcoes, contador);
  }

  private buildConteudoComQuebraData(
    itens: Orcamento[],
    opcoes: OrcamentosRelatorioOpcoes,
    contador: { n: number },
  ): string {
    const grupos = this.agruparRegistrosPor(itens, (item) =>
      this.getChaveAgrupamentoData(item, opcoes.agrupamentoData),
    );
    const rotuloData = this.getAgrupamentoDataLabel(opcoes.agrupamentoData);

    return this.ordenarChavesAgrupamentoData(
      Array.from(grupos.entries()),
      opcoes.agrupamentoData,
    )
      .map(([chave, itensData]) => {
        const rotulo = this.formatarRotuloAgrupamentoData(
          chave,
          opcoes.agrupamentoData,
        );
        const conteudo = this.buildConteudoRelatorio(itensData, opcoes, contador);
        const subtotalHtml =
          opcoes.tipo === 'analitico'
            ? this.buildTotaisHtml(
                itensData,
                `Subtotal ${rotuloData} (${rotulo})`,
                'subtotal',
              )
            : '';
        return `
          <section class="report-subgroup report-subgroup-data">
            <h3 class="subgroup-title">${rotuloData}: ${this.escapeHtml(rotulo)}</h3>
            ${conteudo}
            ${subtotalHtml}
          </section>
        `;
      })
      .join('');
  }

  private buildConteudoSintetico(
    itens: Orcamento[],
    opcoes: OrcamentosRelatorioOpcoes,
  ): string {
    const valorResumo = this.canViewValores()
      ? ` | Soma valor: ${this.escapeHtml(this.formatarMoeda(this.somarPrecoCobrado(itens)))}`
      : '';

    if (opcoes.agrupamentoSecundario === 'nenhum') {
      return `
        <div class="sintetico-total-unidade">
          Total: ${itens.length} registro(s)${valorResumo}
        </div>
      `;
    }

    const grupos = this.agruparRegistrosPor(itens, (item) =>
      this.getValorAgrupamentoSecundario(item, opcoes.agrupamentoSecundario),
    );
    const rotuloColuna = this.getAgrupamentoSecundarioLabel(
      opcoes.agrupamentoSecundario,
    );
    const linhas = Array.from(grupos.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([rotulo, grupoItens]) => {
        const valorCelula = this.canViewValores()
          ? `<td>${this.escapeHtml(this.formatarMoeda(this.somarPrecoCobrado(grupoItens)))}</td>`
          : '';
        return `
          <tr>
            <td>${this.escapeHtml(rotulo)}</td>
            <td>${grupoItens.length}</td>
            ${valorCelula}
          </tr>
        `;
      })
      .join('');

    const valorRodape = this.canViewValores()
      ? `<td>${this.escapeHtml(this.formatarMoeda(this.somarPrecoCobrado(itens)))}</td>`
      : '';
    const valorCabecalho = this.canViewValores() ? '<th>Valor</th>' : '';

    return `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>${rotuloColuna}</th>
              <th>Qtd.</th>
              ${valorCabecalho}
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
          <tfoot>
            <tr>
              <td>Total da unidade</td>
              <td>${itens.length}</td>
              ${valorRodape}
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  private buildConteudoAnalitico(
    itens: Orcamento[],
    opcoes: OrcamentosRelatorioOpcoes,
    contador: { n: number },
  ): string {
    const colunas = this.getColunasAnaliticas(opcoes, itens);

    if (opcoes.agrupamentoSecundario === 'nenhum') {
      return `<div class="table-wrapper">${this.buildReportTableHtml(itens, contador, colunas)}</div>`;
    }

    const grupos = this.agruparRegistrosPor(itens, (item) =>
      this.getValorAgrupamentoSecundario(item, opcoes.agrupamentoSecundario),
    );
    const rotuloGrupo = this.getAgrupamentoSecundarioLabel(
      opcoes.agrupamentoSecundario,
    );

    return Array.from(grupos.entries())
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
      .map(([rotulo, grupoItens]) => {
        const subtotalHtml = this.buildTotaisHtml(
          grupoItens,
          `Subtotal ${rotuloGrupo} (${rotulo})`,
          'subtotal',
        );
        return `
          <section class="report-subgroup">
            <h3 class="subgroup-title">${rotuloGrupo}: ${this.escapeHtml(rotulo)}</h3>
            <div class="table-wrapper">${this.buildReportTableHtml(grupoItens, contador, colunas)}</div>
            ${subtotalHtml}
          </section>
        `;
      })
      .join('');
  }

  private getColunasAnaliticas(
    opcoes: OrcamentosRelatorioOpcoes,
    itens: Orcamento[],
  ): ReportColuna[] {
    const colunas: ReportColuna[] = ['indice', 'nrOrcamento'];

    if (opcoes.agrupamentoData !== 'dia') {
      colunas.push('data');
    }

    colunas.push('cliente');

    if (opcoes.agrupamentoSecundario !== 'vendedor') {
      colunas.push('vendedor');
    }
    if (opcoes.agrupamentoSecundario !== 'medico') {
      colunas.push('medico');
    }
    if (
      this.incluirColunaTipoNoRelatorio(opcoes, itens)
    ) {
      colunas.push('tipo');
    }

    if (this.canViewValores()) {
      colunas.push('precoCobrado');
    }
    if (
      this.exibirColunasRejeitadoParaRelatorio(opcoes) &&
      opcoes.agrupamentoSecundario !== 'motivo'
    ) {
      colunas.push('motivo');
    }
    if (this.exibirColunasRejeitadoParaRelatorio(opcoes)) {
      colunas.push('observacao');
    }
    return colunas;
  }

  private incluirColunaTipoNoRelatorio(
    opcoes: OrcamentosRelatorioOpcoes,
    itens: Orcamento[],
  ): boolean {
    if (opcoes.agrupamentoTipo === 'todos' && this.possuiAmbosStatus(itens)) {
      return false;
    }
    return this.possuiAmbosStatus(itens);
  }

  private exibirColunasRejeitadoParaRelatorio(
    opcoes: OrcamentosRelatorioOpcoes,
  ): boolean {
    if (opcoes.agrupamentoTipo === 'rejeitado') {
      return this.canReadRejeitados();
    }
    if (opcoes.agrupamentoTipo === 'aprovado') {
      return false;
    }
    return this.canReadRejeitados();
  }

  private buildReportTableHtml(
    registros: Orcamento[],
    contador: { n: number },
    colunas: ReportColuna[],
  ): string {
    const linhas = registros
      .map((item) => {
        contador.n += 1;
        const celulas = colunas
          .map((coluna) => `<td>${this.renderCelulaRelatorio(item, coluna, contador.n)}</td>`)
          .join('');
        return `<tr>${celulas}</tr>`;
      })
      .join('');

    const cabecalho = colunas
      .map((coluna) => `<th>${this.getColunaLabel(coluna)}</th>`)
      .join('');

    return `
      <table>
        <thead>
          <tr>${cabecalho}</tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    `;
  }

  private renderCelulaRelatorio(
    item: Orcamento,
    coluna: ReportColuna,
    indice: number,
  ): string {
    switch (coluna) {
      case 'indice':
        return String(indice);
      case 'nrOrcamento':
        return this.escapeHtml(String(item.nrOrcamento ?? '—'));
      case 'data':
        return this.escapeHtml(this.formatarData(item.dataOrcamento));
      case 'cliente':
        return this.escapeHtml(item.nomeCliente || '—');
      case 'vendedor':
        return this.escapeHtml(item.nomeVendedor || '—');
      case 'medico':
        return this.escapeHtml(this.formatarMedico(item));
      case 'tipo':
        return this.escapeHtml(this.formatarStatus(item.status));
      case 'precoCobrado':
        return this.escapeHtml(this.formatarMoeda(item.precoCobrado));
      case 'motivo':
        return this.escapeHtml(item.motivoRejeicao?.descricao || '—');
      case 'observacao':
        return this.escapeHtml(item.observacaoRejeicao || '—');
    }
  }

  private getColunaLabel(coluna: ReportColuna): string {
    const labels: Record<ReportColuna, string> = {
      indice: '#',
      nrOrcamento: 'Nº orçamento',
      data: 'Data',
      cliente: 'Cliente',
      vendedor: 'Vendedor',
      medico: 'Médico',
      tipo: 'Tipo',
      precoCobrado: 'Valor',
      motivo: 'Motivo',
      observacao: 'Observação',
    };
    return labels[coluna];
  }

  private getAgrupamentoSecundarioLabel(
    agrupamento: OrcamentosAgrupamentoSecundario,
  ): string {
    const labels: Record<OrcamentosAgrupamentoSecundario, string> = {
      nenhum: 'Sem agrupamento',
      vendedor: 'Vendedor',
      medico: 'Médico',
      motivo: 'Motivo',
    };
    return labels[agrupamento];
  }

  private getValorAgrupamentoSecundario(
    item: Orcamento,
    agrupamento: OrcamentosAgrupamentoSecundario,
  ): string {
    if (agrupamento === 'vendedor') {
      return item.nomeVendedor || 'Sem vendedor';
    }
    if (agrupamento === 'medico') {
      return this.formatarMedico(item);
    }
    if (agrupamento === 'motivo') {
      return item.motivoRejeicao?.descricao || 'Sem motivo';
    }
    return '';
  }

  private getAgrupamentoDataLabel(
    agrupamento: OrcamentosAgrupamentoData,
  ): string {
    const labels: Record<OrcamentosAgrupamentoData, string> = {
      todos: 'Sem quebra por data',
      ano: 'Ano',
      mes: 'Mês',
      dia: 'Dia',
    };
    return labels[agrupamento];
  }

  private getChaveAgrupamentoData(
    item: Orcamento,
    agrupamento: OrcamentosAgrupamentoData,
  ): string {
    const data = item.dataOrcamento || '';
    if (!data || agrupamento === 'todos') {
      return 'Não informado';
    }
    if (agrupamento === 'ano') {
      return data.slice(0, 4);
    }
    if (agrupamento === 'mes') {
      return data.slice(0, 7);
    }
    return data;
  }

  private formatarRotuloAgrupamentoData(
    chave: string,
    agrupamento: OrcamentosAgrupamentoData,
  ): string {
    if (chave === 'Não informado') {
      return chave;
    }
    if (agrupamento === 'ano') {
      return chave;
    }
    if (agrupamento === 'mes') {
      const [ano, mes] = chave.split('-');
      if (ano && mes) {
        return `${mes}/${ano}`;
      }
      return chave;
    }
    return this.formatarData(chave);
  }

  private ordenarChavesAgrupamentoData(
    entradas: [string, Orcamento[]][],
    agrupamento: OrcamentosAgrupamentoData,
  ): [string, Orcamento[]][] {
    return entradas.sort(([a], [b]) => {
      if (a === 'Não informado') return 1;
      if (b === 'Não informado') return -1;
      if (agrupamento === 'ano' || agrupamento === 'mes' || agrupamento === 'dia') {
        return a.localeCompare(b);
      }
      return a.localeCompare(b, 'pt-BR');
    });
  }

  private agruparRegistrosPor(
    registros: Orcamento[],
    chaveFn: (item: Orcamento) => string,
  ): Map<string, Orcamento[]> {
    const grupos = new Map<string, Orcamento[]>();
    for (const item of registros) {
      const chave = chaveFn(item);
      const lista = grupos.get(chave);
      if (lista) {
        lista.push(item);
      } else {
        grupos.set(chave, [item]);
      }
    }
    return grupos;
  }

  private somarPrecoCobrado(itens: Orcamento[]): number {
    return itens.reduce(
      (total, item) => total + (Number(item.precoCobrado) || 0),
      0,
    );
  }

  private buildTotaisHtml(
    itens: Orcamento[],
    rotulo: string,
    classe: 'subtotal' | 'total-unidade' = 'subtotal',
  ): string {
    const qtd = itens.length;
    const valorHtml = this.canViewValores()
      ? ` | Soma valor: ${this.escapeHtml(this.formatarMoeda(this.somarPrecoCobrado(itens)))}`
      : '';
    return `
      <div class="group-summary ${classe}">
        ${this.escapeHtml(rotulo)}: ${qtd} registro(s)${valorHtml}
      </div>
    `;
  }

  private getReportTimestamp(): string {
    const agora = new Date();
    return `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })}`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
