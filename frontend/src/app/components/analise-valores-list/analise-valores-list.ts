import { Component, OnInit, OnDestroy, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, skip } from 'rxjs';
import { VendaService } from '../../services/vendas.service';
import { AuthService } from '../../services/auth.service';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { PageContextService } from '../../services/page-context.service';
import {
  Venda,
  VendaPaginatedResponse,
  FindVendasDto,
  VendaOrigem,
  VendaStatus,
  Unidade,
  TipoAtualizacao,
} from '../../models/venda.model';
import { Permission } from '../../models/usuario.model';
import { Configuracao } from '../../models/configuracao.model';
import { environment } from '../../../environments/environment';
import { DateRangeFilterComponent, DateRangeValue } from '../date-range-filter/date-range-filter';
import { MultiSelectDropdownComponent, MultiSelectOption } from '../multi-select-dropdown/multi-select-dropdown';
import ExcelJS from 'exceljs';

const STORAGE_KEY = 'analise_valores_list_filters';

type SortDirection = 'asc' | 'desc';
type SortableField =
  | 'protocolo'
  | 'dataVenda'
  | 'dataFechamento'
  | 'unidade'
  | 'origem'
  | 'cliente'
  | 'vendedor'
  | 'valorPago'
  | 'valorCliente'
  | 'valorLucro'
  | 'pctLucro'
  | 'tipoAtualizacao'
  | 'status';

interface AppliedFilter {
  key: string;
  label: string;
  value: string;
}

@Component({
  selector: 'app-analise-valores-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DateRangeFilterComponent, MultiSelectDropdownComponent],
  templateUrl: './analise-valores-list.html',
  styleUrls: ['./analise-valores-list.css'],
  encapsulation: ViewEncapsulation.None,
})
export class AnaliseValoresListComponent implements OnInit, OnDestroy {
  private vendaService = inject(VendaService);
  private authService = inject(AuthService);
  private configuracaoService = inject(ConfiguracaoService);
  private errorModalService = inject(ErrorModalService);
  private pageContextService = inject(PageContextService);
  private destroy$ = new Subject<void>();

  configuracao: Configuracao | null = null;
  items: Venda[] = [];
  loading = false;
  error = '';

  currentPage = 1;
  pageSize = 1000;
  totalItems = 0;
  totalPages = 0;

  protocoloFilter = '';
  clienteFilter = '';
  origemFilter: VendaOrigem[] = [];
  statusFilter: VendaStatus[] = [];
  dataInicialFilter = '';
  dataFinalFilter = '';
  dataInicialFechamentoFilter = '';
  dataFinalFechamentoFilter = '';
  semDataFechamentoFilter = false;
  comDataFechamentoFilter = true; // Sempre ativo: apenas vendas com fechamento (checkbox desabilitado na UI)
  unidadeFilter: Unidade[] = [];
  vendedorFilter = '';
  /** % Lucro menor que (ex.: 25 para mostrar vendas com % Lucro < 25%) */
  pctLucroMenorQueFilter: string = '';
  /** % Lucro maior que (ex.: 50 para mostrar vendas com % Lucro > 50%) */
  pctLucroMaiorQueFilter: string = '';
  unidadeDisabled = false;

  filtersPanelOpen = false;
  selectedVendas = new Set<string>();

  sortField: SortableField | null = null;
  sortDirection: SortDirection = 'asc';

  readonly VendaOrigem = VendaOrigem;
  readonly VendaStatus = VendaStatus;
  readonly Permission = Permission;
  readonly unidades = Object.values(Unidade);
  readonly origens = Object.values(VendaOrigem);
  readonly statusOptions = [
    VendaStatus.REGISTRADO,
    VendaStatus.CANCELADO,
    VendaStatus.PAGO,
    VendaStatus.PAGO_PARCIAL,
  ];

  ngOnInit(): void {
    if (!this.canView()) {
      this.error = 'Você não possui permissão para acessar a Análise de Valores.';
      return;
    }
    this.initializeUnidadeFilter();
    this.restoreFilters();
    this.initializeDefaultDateFilter();
    this.authService.currentUser$.pipe(skip(1), takeUntil(this.destroy$)).subscribe(() => {
      this.initializeUnidadeFilter();
      this.loadItems();
    });
    this.configuracaoService.getConfiguracao().subscribe({
      next: (c) => (this.configuracao = c),
      error: () => (this.configuracao = null),
    });
    this.pageContextService.setContext({
      title: 'Análise de Valores',
      description: 'Relatório de análise com valor recebido, valor fechamento, lucro e percentual.',
    });
    this.loadItems();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.pageContextService.resetContext();
  }

  canView(): boolean {
    return this.authService.hasPermission(Permission.VENDA_ANALISE_VALORES);
  }

  canViewValorCompra(): boolean {
    return this.authService.hasPermission(Permission.VENDA_VIEW_VALOR_COMPRA);
  }

  private initializeUnidadeFilter(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser?.unidade && String(currentUser.unidade).trim() !== '') {
      this.unidadeFilter = [currentUser.unidade as Unidade];
      this.unidadeDisabled = true;
    } else {
      this.unidadeDisabled = false;
      this.unidadeFilter = [];
    }
  }

  /** Ao carregar o relatório, aplica filtro de data de fechamento: primeiro e último dia do ano atual. */
  private initializeDefaultDateFilter(): void {
    const year = new Date().getFullYear();
    this.dataInicialFechamentoFilter = `${year}-01-01`;
    this.dataFinalFechamentoFilter = `${year}-12-31`;
  }

  private restoreFilters(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.protocoloFilter = data.protocoloFilter ?? '';
        this.clienteFilter = data.clienteFilter ?? '';
        this.origemFilter = Array.isArray(data.origemFilter) ? data.origemFilter : [];
        this.statusFilter = Array.isArray(data.statusFilter) ? data.statusFilter : [];
        this.dataInicialFilter = data.dataInicialFilter ?? '';
        this.dataFinalFilter = data.dataFinalFilter ?? '';
        this.dataInicialFechamentoFilter = data.dataInicialFechamentoFilter ?? '';
        this.dataFinalFechamentoFilter = data.dataFinalFechamentoFilter ?? '';
        this.semDataFechamentoFilter = false;
        this.comDataFechamentoFilter = true; // Sempre vendas com fechamento
        if (!this.unidadeDisabled) {
          this.unidadeFilter = Array.isArray(data.unidadeFilter) ? data.unidadeFilter : [];
        }
        this.vendedorFilter = data.vendedorFilter ?? '';
        this.pctLucroMenorQueFilter = data.pctLucroMenorQueFilter ?? '';
        this.pctLucroMaiorQueFilter = data.pctLucroMaiorQueFilter ?? '';
        this.currentPage = data.currentPage ?? 1;
      }
    } catch {
      // ignore
    }
  }

  private saveFilters(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          protocoloFilter: this.protocoloFilter,
          clienteFilter: this.clienteFilter,
          origemFilter: this.origemFilter,
          statusFilter: this.statusFilter,
          dataInicialFilter: this.dataInicialFilter,
          dataFinalFilter: this.dataFinalFilter,
          dataInicialFechamentoFilter: this.dataInicialFechamentoFilter,
          dataFinalFechamentoFilter: this.dataFinalFechamentoFilter,
          semDataFechamentoFilter: this.semDataFechamentoFilter,
          comDataFechamentoFilter: this.comDataFechamentoFilter,
          unidadeFilter: this.unidadeFilter,
          vendedorFilter: this.vendedorFilter,
          pctLucroMenorQueFilter: this.pctLucroMenorQueFilter,
          pctLucroMaiorQueFilter: this.pctLucroMaiorQueFilter,
          currentPage: this.currentPage,
        })
      );
    } catch {
      // ignore
    }
  }

  loadItems(): void {
    this.loading = true;
    this.error = '';

    const filters: FindVendasDto = { page: this.currentPage, limit: this.pageSize };

    if (this.protocoloFilter.trim()) filters.protocolo = this.protocoloFilter.trim();
    if (this.clienteFilter.trim()) filters.cliente = this.clienteFilter.trim();
    if (this.origemFilter.length > 0) {
      filters.origem = this.origemFilter.length === 1 ? this.origemFilter[0] : this.origemFilter;
    }
    if (this.statusFilter.length > 0) {
      filters.status = this.statusFilter.length === 1 ? this.statusFilter[0] : this.statusFilter;
    }
    if (this.dataInicialFilter) filters.dataInicial = this.dataInicialFilter;
    if (this.dataFinalFilter) filters.dataFinal = this.dataFinalFilter;
    if (this.semDataFechamentoFilter) {
      filters.semDataFechamento = true;
    } else {
      if (this.comDataFechamentoFilter) filters.comDataFechamento = true;
      if (this.dataInicialFechamentoFilter) filters.dataInicialFechamento = this.dataInicialFechamentoFilter;
      if (this.dataFinalFechamentoFilter) filters.dataFinalFechamento = this.dataFinalFechamentoFilter;
    }
    if (this.unidadeFilter.length > 0) {
      filters.unidade = this.unidadeFilter.length === 1 ? this.unidadeFilter[0] : this.unidadeFilter;
    }
    if (this.vendedorFilter.trim()) filters.vendedor = this.vendedorFilter.trim();
    const pctMenor = this.parsePctLucro(this.pctLucroMenorQueFilter);
    if (pctMenor != null) filters.pctLucroMenorQue = pctMenor;
    const pctMaior = this.parsePctLucro(this.pctLucroMaiorQueFilter);
    if (pctMaior != null) filters.pctLucroMaiorQue = pctMaior;

    this.vendaService.getVendas(filters).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res: VendaPaginatedResponse) => {
        this.items = res.data;
        this.applySorting();
        this.totalItems = res.meta.total;
        this.totalPages = res.meta.totalPages;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.errorModalService.show('Erro ao carregar dados.', 'Erro');
      },
    });
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.saveFilters();
    this.filtersPanelOpen = false;
    this.loadItems();
  }

  get appliedFilters(): AppliedFilter[] {
    const f: AppliedFilter[] = [];
    if (this.protocoloFilter.trim()) f.push({ key: 'protocolo', label: 'Protocolo', value: this.protocoloFilter.trim() });
    if (this.clienteFilter.trim()) f.push({ key: 'cliente', label: 'Cliente', value: this.clienteFilter.trim() });
    if (this.origemFilter.length > 0) {
      f.push({ key: 'origem', label: 'Comprado em', value: this.origemFilter.map((o) => this.getOrigemLabel(o)).join(', ') });
    }
    if (this.statusFilter.length > 0) {
      f.push({ key: 'status', label: 'Status', value: this.statusFilter.map((s) => this.getStatusLabel(s)).join(', ') });
    }
    if (this.dataInicialFilter || this.dataFinalFilter) {
      const from = this.dataInicialFilter ? this.formatDate(this.dataInicialFilter) : '';
      const to = this.dataFinalFilter ? this.formatDate(this.dataFinalFilter) : '';
      let value = from && to ? `${from} a ${to}` : from ? `A partir de ${from}` : to ? `Até ${to}` : '';
      f.push({ key: 'dataVenda', label: 'Data da Venda', value });
    }
    if (this.semDataFechamentoFilter) f.push({ key: 'semDataFechamento', label: 'Sem data de fechamento', value: 'Sim' });
    if (this.comDataFechamentoFilter) f.push({ key: 'comDataFechamento', label: 'Vendas com fechamento', value: 'Sim' });
    if (!this.semDataFechamentoFilter && (this.dataInicialFechamentoFilter || this.dataFinalFechamentoFilter)) {
      const from = this.dataInicialFechamentoFilter ? this.formatDate(this.dataInicialFechamentoFilter) : '';
      const to = this.dataFinalFechamentoFilter ? this.formatDate(this.dataFinalFechamentoFilter) : '';
      let value = from && to ? `${from} a ${to}` : from ? `A partir de ${from}` : to ? `Até ${to}` : '';
      f.push({ key: 'dataFechamento', label: 'Data de Fechamento', value });
    }
    if (this.unidadeFilter.length > 0) {
      f.push({ key: 'unidade', label: 'Unidade', value: this.unidadeFilter.join(', ') });
    }
    if (this.vendedorFilter.trim()) f.push({ key: 'vendedor', label: 'Vendedor', value: this.vendedorFilter.trim() });
    const pctMenor = this.parsePctLucro(this.pctLucroMenorQueFilter);
    if (pctMenor != null) f.push({ key: 'pctLucroMenorQue', label: '% Lucro menor que', value: `${pctMenor}%` });
    const pctMaior = this.parsePctLucro(this.pctLucroMaiorQueFilter);
    if (pctMaior != null) f.push({ key: 'pctLucroMaiorQue', label: '% Lucro maior que', value: `${pctMaior}%` });
    return f;
  }

  clearAppliedFilter(key: string): void {
    switch (key) {
      case 'protocolo': this.protocoloFilter = ''; break;
      case 'cliente': this.clienteFilter = ''; break;
      case 'origem': this.origemFilter = []; break;
      case 'status': this.statusFilter = []; break;
      case 'dataVenda': this.dataInicialFilter = ''; this.dataFinalFilter = ''; break;
      case 'semDataFechamento': this.semDataFechamentoFilter = false; break;
      case 'comDataFechamento': return; // Filtro fixo, não pode ser removido
      case 'dataFechamento': this.dataInicialFechamentoFilter = ''; this.dataFinalFechamentoFilter = ''; break;
      case 'unidade': if (!this.unidadeDisabled) this.unidadeFilter = []; break;
      case 'vendedor': this.vendedorFilter = ''; break;
      case 'pctLucroMenorQue': this.pctLucroMenorQueFilter = ''; break;
      case 'pctLucroMaiorQue': this.pctLucroMaiorQueFilter = ''; break;
      default: break;
    }
    this.currentPage = 1;
    this.saveFilters();
    this.loadItems();
  }

  isMultipleFilter(key: string): boolean {
    return ['origem', 'unidade', 'status'].includes(key);
  }

  getFilterIcon(key: string): string {
    const icons: Record<string, string> = {
      protocolo: 'fa-hashtag',
      cliente: 'fa-user',
      origem: 'fa-map-marker-alt',
      status: 'fa-info-circle',
      dataVenda: 'fa-calendar-alt',
      semDataFechamento: 'fa-calendar-times',
      dataFechamento: 'fa-calendar-check',
      comDataFechamento: 'fa-calendar-check',
      unidade: 'fa-building',
      vendedor: 'fa-user-tie',
      pctLucroMenorQue: 'fa-percent',
      pctLucroMaiorQue: 'fa-percent',
    };
    return icons[key] ?? 'fa-filter';
  }

  formatFilterValue(filter: AppliedFilter): string {
    return filter.value.length > 30 ? filter.value.substring(0, 30) + '...' : filter.value;
  }

  onVendaRangeChange(range: DateRangeValue): void {
    this.dataInicialFilter = range.start ?? '';
    this.dataFinalFilter = range.end ?? '';
    this.applyFilters();
  }

  onFechamentoRangeChange(range: DateRangeValue): void {
    this.dataInicialFechamentoFilter = range.start ?? '';
    this.dataFinalFechamentoFilter = range.end ?? '';
    this.applyFilters();
  }

  onVendaRangeChangeModal(range: DateRangeValue): void {
    this.dataInicialFilter = range.start ?? '';
    this.dataFinalFilter = range.end ?? '';
  }

  onFechamentoRangeChangeModal(range: DateRangeValue): void {
    this.dataInicialFechamentoFilter = range.start ?? '';
    this.dataFinalFechamentoFilter = range.end ?? '';
  }

  onFiltersToggleKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleFiltersVisibility();
    }
  }

  onContainerClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target) return;
    const btnToggle = target.closest('.btn-toggle-filtros');
    const chipRemove = target.closest('.chip-remove');
    const btnClearAll = target.closest('.btn-clear-all');
    const resultsCount = target.closest('.results-count');
    if (btnToggle || chipRemove || btnClearAll || resultsCount) return;
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

  clearFilters(): void {
    this.protocoloFilter = '';
    this.clienteFilter = '';
    this.origemFilter = [];
    this.statusFilter = [];
    this.dataInicialFilter = '';
    this.dataFinalFilter = '';
    this.dataInicialFechamentoFilter = '';
    this.dataFinalFechamentoFilter = '';
    this.semDataFechamentoFilter = false;
    // comDataFechamentoFilter permanece true (sempre vendas com fechamento)
    if (!this.unidadeDisabled) {
      this.unidadeFilter = [];
    }
    this.vendedorFilter = '';
    this.pctLucroMenorQueFilter = '';
    this.pctLucroMaiorQueFilter = '';
    this.currentPage = 1;
    this.saveFilters();
    this.loadItems();
  }

  /** Retorna o número do filtro % Lucro (menor que / maior que), ou null se vazio/inválido */
  parsePctLucro(value: string): number | null {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim().replace(',', '.');
    if (!trimmed) return null;
    const n = parseFloat(trimmed);
    if (Number.isNaN(n) || n < 0) return null;
    return n;
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.saveFilters();
    this.loadItems();
  }

  toggleFiltersVisibility(): void {
    this.filtersPanelOpen = !this.filtersPanelOpen;
  }

  toggleSelectAll(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.checked) this.items.forEach((v) => this.selectedVendas.add(v.id));
    else this.selectedVendas.clear();
  }

  toggleSelectVenda(vendaId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.checked) this.selectedVendas.add(vendaId);
    else this.selectedVendas.delete(vendaId);
  }

  onRowClick(venda: Venda, event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('input[type="checkbox"]')) return;
    if (this.selectedVendas.has(venda.id)) this.selectedVendas.delete(venda.id);
    else this.selectedVendas.add(venda.id);
  }

  isVendaSelected(id: string): boolean {
    return this.selectedVendas.has(id);
  }

  isAllSelected(): boolean {
    return this.items.length > 0 && this.selectedVendas.size === this.items.length;
  }

  isIndeterminate(): boolean {
    return this.selectedVendas.size > 0 && this.selectedVendas.size < this.items.length;
  }

  getSelectedVendaModels(): Venda[] {
    return this.items.filter((v) => this.selectedVendas.has(v.id));
  }

  /** Formata data no padrão dd/mm/yyyy usando apenas a parte da data, sem conversão de timezone (igual fechamento-vendas-list). */
  formatDate(value: string | null | undefined): string {
    if (!value) return '-';
    const datePart = String(value).split('T')[0];
    if (!datePart || datePart.length < 10) return '-';
    const [year, month, day] = datePart.split('-');
    if (!year || !month || !day) return '-';
    return `${day}/${month}/${year}`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  getClienteNome(venda: Venda): string {
    return venda.cliente?.nome ?? '-';
  }

  getOrigemLabel(origem: VendaOrigem): string {
    const labels: Record<string, string> = {
      [VendaOrigem.GOIANIA]: 'Goiânia',
      [VendaOrigem.INHUMAS]: 'Inhumas',
      [VendaOrigem.UBERABA]: 'Uberaba',
      [VendaOrigem.NEROPOLIS]: 'Nerópolis',
      [VendaOrigem.RIBEIRAO_PRETO]: 'Ribeirão Preto',
      [VendaOrigem.OUTRO]: 'Outro',
    };
    return labels[origem] ?? origem;
  }

  getStatusLabel(status: VendaStatus): string {
    const labels: Record<string, string> = {
      [VendaStatus.REGISTRADO]: 'Registrado',
      [VendaStatus.CANCELADO]: 'Cancelado',
      [VendaStatus.PAGO]: 'Pago',
      [VendaStatus.PAGO_PARCIAL]: 'Pago Parcial'
    };
    return labels[status] ?? status;
  }

  getStatusClass(status: VendaStatus): string {
    const classes: Record<string, string> = {
      [VendaStatus.REGISTRADO]: 'status-registrado',
      [VendaStatus.CANCELADO]: 'status-cancelado',
      [VendaStatus.PAGO]: 'status-pago',
      [VendaStatus.PAGO_PARCIAL]: 'status-pago-parcial'
    };
    return classes[status] ?? '';
  }

  getVendedorNome(venda: Venda): string {
    if (venda.vendedor && typeof venda.vendedor === 'object') {
      return (venda.vendedor as { nome?: string }).nome ?? '-';
    }
    return (venda.vendedor as unknown as string) || '-';
  }

  onSort(field: SortableField): void {
    if (this.loading) return;
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.applySorting();
  }

  private applySorting(): void {
    if (!this.sortField) return;
    const direction = this.sortDirection === 'asc' ? 1 : -1;
    const field = this.sortField;
    this.items = [...this.items].sort((a, b) => {
      const valueA = this.getSortableValue(a, field);
      const valueB = this.getSortableValue(b, field);
      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return 1;
      if (valueB == null) return -1;
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        if (valueA === valueB) return 0;
        return valueA > valueB ? direction : -direction;
      }
      return valueA.toString().localeCompare(valueB.toString(), 'pt-BR', { sensitivity: 'base', numeric: true }) * direction;
    });
  }

  /** Converte string YYYY-MM-DD em número YYYYMMDD para ordenação sem timezone. */
  private dateStringToSortKey(value: string | null | undefined): number | null {
    if (!value) return null;
    const datePart = String(value).split('T')[0];
    if (!datePart || datePart.length < 10) return null;
    const [y, m, d] = datePart.split('-').map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    return y * 10000 + m * 100 + d;
  }

  private getSortableValue(venda: Venda, field: SortableField): string | number | null {
    switch (field) {
      case 'protocolo':
        return venda.protocolo;
      case 'dataVenda':
        return this.dateStringToSortKey(venda.dataVenda);
      case 'dataFechamento':
        return this.dateStringToSortKey(venda.dataFechamento ?? undefined);
      case 'unidade':
        return venda.unidade ?? '';
      case 'origem':
        return this.getOrigemLabel(venda.origem);
      case 'cliente':
        return this.getClienteNome(venda);
      case 'vendedor':
        return this.getVendedorNome(venda);
      case 'valorPago':
        return venda.valorPago ?? 0;
      case 'valorCliente':
        return venda.valorCliente ?? 0;
      case 'valorLucro':
        return (venda.valorCliente ?? 0) - (venda.valorPago ?? 0);
      case 'pctLucro': {
        const vPago = venda.valorPago ?? 0;
        return vPago > 0 ? ((venda.valorCliente ?? 0) - vPago) / vPago * 100 : 0;
      }
      case 'tipoAtualizacao':
        return this.getTipoAtualizacaoLabel(venda.tipoAtualizacao);
      case 'status':
        return this.getStatusLabel(venda.status);
      default:
        return venda.protocolo;
    }
  }

  getTipoAtualizacaoLabel(tipo?: TipoAtualizacao): string {
    if (!tipo) return '-';
    const labels: Record<string, string> = {
      [TipoAtualizacao.FORMULA_CERTA_AGENTE]: 'Formula Certa',
      [TipoAtualizacao.VALOR_CLIENTE]: 'Valor Cliente',
    };
    return labels[tipo] ?? tipo;
  }

  getReportTimestamp(): string {
    const n = new Date();
    const pad = (x: number) => String(x).padStart(2, '0');
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())} ${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
  }

  getLogoRelatorioUrl(): string | null {
    if (!this.configuracao?.hasLogo) return null;
    return `${environment.apiUrl}/configuracao/logo`;
  }

  getOrigemOptions(): MultiSelectOption[] {
    return this.origens.map((o) => ({ value: o, label: this.getOrigemLabel(o) }));
  }

  getStatusOptions(): MultiSelectOption[] {
    return this.statusOptions.map((s) => ({ value: s, label: this.getStatusLabel(s) }));
  }

  getUnidadeOptions(): MultiSelectOption[] {
    return this.unidades.map((u) => ({ value: u, label: u }));
  }

  imprimirAnalise(): void {
    const vendas = this.getSelectedVendaModels();
    if (vendas.length === 0) {
      this.errorModalService.show('Selecione ao menos uma venda para imprimir.', 'Aviso');
      return;
    }
    const popup = window.open('', '_blank', 'width=1024,height=768');
    if (!popup) {
      this.errorModalService.show('Não foi possível abrir a janela de impressão. Verifique bloqueadores de pop-up.', 'Erro');
      return;
    }

    const reportTitle = 'Análise dos Valores';
    const reportTimestamp = this.getReportTimestamp();
    const reportDocumentTitle = `Relatório - ${reportTitle} ${reportTimestamp}`;
    const user = this.authService.getCurrentUser();
    const usuarioLabel = user?.nome || user?.email || 'Usuário';
    const now = new Date();
    const geradoEm = `Gerado em ${now.toLocaleDateString('pt-BR')}, ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} por ${usuarioLabel}`;
    const logoUrl = this.getLogoRelatorioUrl();
    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : '';

    const unidadeMap = new Map<string, Map<string, Venda[]>>();
    vendas.forEach((v) => {
      const un = v.unidade || 'Não informado';
      const orig = this.getOrigemLabel(v.origem);
      if (!unidadeMap.has(un)) unidadeMap.set(un, new Map());
      const om = unidadeMap.get(un)!;
      if (!om.has(orig)) om.set(orig, []);
      om.get(orig)!.push(v);
    });

    const unidadesOrdenadas = Array.from(unidadeMap.keys()).sort((a, b) => {
      if (a === 'Não informado') return 1;
      if (b === 'Não informado') return -1;
      return a.localeCompare(b);
    });

    let contador = 0;
    let totalValorFechamento = 0;
    let totalValorRecebido = 0;
    let totalValorLucro = 0;

    const tabelasPorUnidade = unidadesOrdenadas
      .map((unidade) => {
        const origemMap = unidadeMap.get(unidade)!;
        const origensOrdenadas = Array.from(origemMap.keys()).sort((a, b) => a.localeCompare(b));
        let uFech = 0, uRec = 0, uLucro = 0;

        const blocos = origensOrdenadas
          .map((origem) => {
            const vendasOrigem = origemMap.get(origem)!;
            let oFech = 0, oRec = 0, oLucro = 0;

            const linhas = vendasOrigem
              .map((v) => {
                contador++;
                const vFech = v.valorPago ?? 0;
                const vRec = v.valorCliente ?? 0;
                const vLucro = vRec - vFech;
                const pct = vFech > 0 ? (vLucro / vFech) * 100 : 0;
                oFech += vFech;
                oRec += vRec;
                oLucro += vLucro;

                const pctTexto = vFech > 0 ? `${Number(pct.toFixed(1))}%` : '-';

                return `<tr>
                  <td>${contador}</td><td>${v.protocolo}</td><td>${this.formatDate(v.dataVenda)}</td><td>${this.getClienteNome(v)}</td><td>${this.getVendedorNome(v)}</td>
                  <td>${this.formatCurrency(vFech)}</td><td>${this.formatCurrency(vRec)}</td><td>${this.formatCurrency(vLucro)}</td><td>${pctTexto}</td><td>${this.getStatusLabel(v.status)}</td>
                </tr>`;
              })
              .join('');

            const oPct = oFech > 0 ? `${Number((oLucro / oFech) * 100).toFixed(1)}%` : '-';
            uFech += oFech;
            uRec += oRec;
            uLucro += oLucro;

            return `<div class="origem-block">
              <div class="origem-title">Comprado em: ${origem}</div>
              <div class="table-wrapper">
                <table>
                  <thead><tr>
                    <th>#</th><th>Protocolo</th><th>Venda</th><th>Cliente</th><th>Vendedor</th>
                    <th>Valor Custo</th><th>Valor Venda</th><th>Valor Lucro</th><th>% Lucro</th><th>Status</th>
                  </tr></thead>
                  <tbody>${linhas}
                    <tr class="totals-row"><td class="totals-label" colspan="5">Total</td>
                    <td>${this.formatCurrency(oFech)}</td><td>${this.formatCurrency(oRec)}</td><td>${this.formatCurrency(oLucro)}</td><td>${oPct}</td><td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>`;
          })
          .join('');

        const uPct = uFech > 0 ? `${Number((uLucro / uFech) * 100).toFixed(1)}%` : '-';
        totalValorFechamento += uFech;
        totalValorRecebido += uRec;
        totalValorLucro += uLucro;

        return `<section class="unit-section">
          <div class="unit-title">Unidade: ${unidade}</div>${blocos}
          <div class="unit-total-row">
            <span>Total Unidade ${unidade}:</span>
            <span><strong>Valor Custo:</strong> ${this.formatCurrency(uFech)}</span>
            <span><strong>Valor Venda:</strong> ${this.formatCurrency(uRec)}</span>
            <span><strong>Valor Lucro:</strong> ${this.formatCurrency(uLucro)}</span>
            <span><strong>% Lucro:</strong> ${uPct}</span>
          </div>
        </section>`;
      })
      .join('');

    const totalPct = totalValorFechamento > 0 ? `${Number((totalValorLucro / totalValorFechamento) * 100).toFixed(1)}%` : '-';

    const styles = `
      body{font-family:'Segoe UI',Arial,sans-serif;margin:16px;color:#1a202c;font-size:12px;background:#fff;margin-bottom:80px}
      h1{margin:0;font-size:20px}
      .print-actions{text-align:right;margin-bottom:12px}
      .print-actions button{background:#2b6cb0;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:11px}
      .report-header{display:flex;align-items:center;gap:16px;margin-bottom:8px}
      .logo-area,.header-spacer{flex:0 0 220px}
      .header-spacer{visibility:hidden}
      .logo-area img{max-height:60px}
      .title-area{flex:1;text-align:center}
      .unit-section{margin-top:24px;page-break-inside:avoid}
      .unit-title{font-weight:600;text-transform:uppercase;font-size:12px;margin-bottom:6px;color:#1e293b}
      .origem-block{margin-top:16px}
      .origem-title{font-weight:600;text-transform:uppercase;font-size:11px;margin:12px 0 4px;color:#334155}
      .table-wrapper{border:1px solid #cbd5e0;overflow:hidden;margin-top:4px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border-bottom:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      th{background:#edf2f7;font-size:11px}
      .totals-row td{font-weight:600;background:#fffbea}
      .totals-label{text-align:right;padding-right:12px}
      .unit-total-row{margin-top:12px;border:1px solid #cbd5e0;padding:8px 12px;background:#e2e8f0;font-size:11px;font-weight:600;display:flex;flex-wrap:wrap;gap:12px}
      .totals-summary{margin-top:20px;border:1px solid #cbd5e0;padding:12px 16px;background:#f7fafc;display:flex;flex-wrap:wrap;gap:16px;font-size:11px}
      footer{position:fixed;bottom:12px;left:20px;right:20px;text-align:right;font-size:10px;color:#4a5568}
      @media print{.print-actions{display:none}body{margin:0 20px 80px}}
    `;

    popup.document.write(`
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${reportDocumentTitle}</title><style>${styles}</style></head>
      <body>
        <div class="print-actions"><button onclick="window.print()">Imprimir PDF</button></div>
        <header class="report-header">
          <div class="logo-area">${logoHtml}</div>
          <div class="title-area"><h1>${reportTitle}</h1></div>
          <div class="header-spacer">&nbsp;</div>
        </header>
        ${tabelasPorUnidade}
        <div class="totals-summary">
          <div><strong>Total Valor Custo:</strong> ${this.formatCurrency(totalValorFechamento)}</div>
          <div><strong>Total Valor Venda:</strong> ${this.formatCurrency(totalValorRecebido)}</div>
          <div><strong>Total Valor Lucro:</strong> ${this.formatCurrency(totalValorLucro)}</div>
          <div><strong>% Lucro:</strong> ${totalPct}</div>
        </div>
        <footer>${geradoEm}</footer>
      </body></html>
    `);
    popup.document.close();
    popup.document.title = reportDocumentTitle;
    popup.focus();
  }

  /** Relatório com mesma informação do imprimir, com nível extra de quebra por Data de Fechamento (Unidade -> Comprado em -> Fechamento -> Total). */
  imprimirPorFechamento(): void {
    const vendas = this.getSelectedVendaModels();
    if (vendas.length === 0) {
      this.errorModalService.show('Selecione ao menos uma venda para imprimir.', 'Aviso');
      return;
    }
    const popup = window.open('', '_blank', 'width=1024,height=768');
    if (!popup) {
      this.errorModalService.show('Não foi possível abrir a janela de impressão. Verifique bloqueadores de pop-up.', 'Erro');
      return;
    }

    const reportTitle = 'Análise dos Valores - Por Fechamento';
    const reportTimestamp = this.getReportTimestamp();
    const reportDocumentTitle = `Relatório - ${reportTitle} ${reportTimestamp}`;
    const user = this.authService.getCurrentUser();
    const usuarioLabel = user?.nome || user?.email || 'Usuário';
    const now = new Date();
    const geradoEm = `Gerado em ${now.toLocaleDateString('pt-BR')}, ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} por ${usuarioLabel}`;
    const logoUrl = this.getLogoRelatorioUrl();
    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : '';

    const SEM_DATA_KEY = '__sem_data__';
    type OrigemMap = Map<string, Venda[]>;
    type FechamentoMap = Map<string, OrigemMap>;
    const unidadeMap = new Map<string, FechamentoMap>();

    vendas.forEach((v) => {
      const un = v.unidade || 'Não informado';
      const orig = this.getOrigemLabel(v.origem);
      const dataFech = v.dataFechamento && v.dataFechamento.trim() ? v.dataFechamento.trim() : SEM_DATA_KEY;
      if (!unidadeMap.has(un)) unidadeMap.set(un, new Map());
      const fechMap = unidadeMap.get(un)!;
      if (!fechMap.has(orig)) fechMap.set(orig, new Map());
      const origemMap = fechMap.get(orig)!;
      if (!origemMap.has(dataFech)) origemMap.set(dataFech, []);
      origemMap.get(dataFech)!.push(v);
    });

    const unidadesOrdenadas = Array.from(unidadeMap.keys()).sort((a, b) => {
      if (a === 'Não informado') return 1;
      if (b === 'Não informado') return -1;
      return a.localeCompare(b);
    });

    const sortFechamentoKeys = (keys: string[]): string[] => {
      return keys.slice().sort((a, b) => {
        if (a === SEM_DATA_KEY) return 1;
        if (b === SEM_DATA_KEY) return -1;
        return a.localeCompare(b);
      });
    };

    let contador = 0;
    let totalValorFechamento = 0;
    let totalValorRecebido = 0;
    let totalValorLucro = 0;

    const tabelasPorUnidade = unidadesOrdenadas
      .map((unidade) => {
        const fechamentoMap = unidadeMap.get(unidade)!;
        const origensOrdenadas = Array.from(fechamentoMap.keys()).sort((a, b) => a.localeCompare(b));
        let uFech = 0, uRec = 0, uLucro = 0;

        const blocosOrigem = origensOrdenadas
          .map((origem) => {
            const origemDataMap = fechamentoMap.get(origem)!;
            const fechamentoKeys = sortFechamentoKeys(Array.from(origemDataMap.keys()));
            let oFech = 0, oRec = 0, oLucro = 0;

            const blocosFechamento = fechamentoKeys
              .map((dataFechKey) => {
                const vendasFech = origemDataMap.get(dataFechKey)!;
                let fFech = 0, fRec = 0, fLucro = 0;

                const linhas = vendasFech
                  .map((v) => {
                    contador++;
                    const vFech = v.valorPago ?? 0;
                    const vRec = v.valorCliente ?? 0;
                    const vLucro = vRec - vFech;
                    const pct = vFech > 0 ? (vLucro / vFech) * 100 : 0;
                    fFech += vFech;
                    fRec += vRec;
                    fLucro += vLucro;
                    oFech += vFech;
                    oRec += vRec;
                    oLucro += vLucro;
                    const pctTexto = vFech > 0 ? `${Number(pct.toFixed(1))}%` : '-';
                    return `<tr>
                      <td>${contador}</td><td>${v.protocolo}</td><td>${this.formatDate(v.dataVenda)}</td><td>${this.getClienteNome(v)}</td><td>${this.getVendedorNome(v)}</td>
                      <td>${this.formatCurrency(vFech)}</td><td>${this.formatCurrency(vRec)}</td><td>${this.formatCurrency(vLucro)}</td><td>${pctTexto}</td><td>${this.getStatusLabel(v.status)}</td>
                    </tr>`;
                  })
                  .join('');

                const fPct = fFech > 0 ? `${Number((fLucro / fFech) * 100).toFixed(1)}%` : '-';
                const fechamentoLabel = dataFechKey === SEM_DATA_KEY ? 'Sem data' : this.formatDate(dataFechKey);
                const tituloFechamento = `Unidade: ${unidade} | Comprado em: ${origem} | Fechamento: ${fechamentoLabel}`;

                return `<div class="fechamento-block">
                  <div class="fechamento-title">${tituloFechamento}</div>
                  <div class="table-wrapper">
                    <table>
                      <thead><tr>
                        <th>#</th><th>Protocolo</th><th>Venda</th><th>Cliente</th><th>Vendedor</th>
                        <th>Valor Custo</th><th>Valor Venda</th><th>Valor Lucro</th><th>% Lucro</th><th>Status</th>
                      </tr></thead>
                      <tbody>${linhas}
                        <tr class="totals-row"><td class="totals-label" colspan="5">Total</td>
                        <td>${this.formatCurrency(fFech)}</td><td>${this.formatCurrency(fRec)}</td><td>${this.formatCurrency(fLucro)}</td><td>${fPct}</td><td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>`;
              })
              .join('');

            const oPct = oFech > 0 ? `${Number((oLucro / oFech) * 100).toFixed(1)}%` : '-';
            uFech += oFech;
            uRec += oRec;
            uLucro += oLucro;

            return `<div class="origem-block">
              <div class="origem-title">Comprado em: ${origem}</div>
              ${blocosFechamento}
            </div>`;
          })
          .join('');

        const uPct = uFech > 0 ? `${Number((uLucro / uFech) * 100).toFixed(1)}%` : '-';
        totalValorFechamento += uFech;
        totalValorRecebido += uRec;
        totalValorLucro += uLucro;

        return `<section class="unit-section">
          <div class="unit-title">Unidade: ${unidade}</div>${blocosOrigem}
          <div class="unit-total-row">
            <span>Total Unidade ${unidade}:</span>
            <span><strong>Valor Custo:</strong> ${this.formatCurrency(uFech)}</span>
            <span><strong>Valor Venda:</strong> ${this.formatCurrency(uRec)}</span>
            <span><strong>Valor Lucro:</strong> ${this.formatCurrency(uLucro)}</span>
            <span><strong>% Lucro:</strong> ${uPct}</span>
          </div>
        </section>`;
      })
      .join('');

    const totalPct = totalValorFechamento > 0 ? `${Number((totalValorLucro / totalValorFechamento) * 100).toFixed(1)}%` : '-';

    const styles = `
      body{font-family:'Segoe UI',Arial,sans-serif;margin:16px;color:#1a202c;font-size:12px;background:#fff;margin-bottom:80px}
      h1{margin:0;font-size:20px}
      .print-actions{text-align:right;margin-bottom:12px}
      .print-actions button{background:#2b6cb0;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:11px}
      .report-header{display:flex;align-items:center;gap:16px;margin-bottom:8px}
      .logo-area,.header-spacer{flex:0 0 220px}
      .header-spacer{visibility:hidden}
      .logo-area img{max-height:60px}
      .title-area{flex:1;text-align:center}
      .unit-section{margin-top:24px;page-break-inside:avoid}
      .unit-title{font-weight:600;text-transform:uppercase;font-size:12px;margin-bottom:6px;color:#1e293b}
      .origem-block{margin-top:16px}
      .origem-title{font-weight:600;text-transform:uppercase;font-size:11px;margin:12px 0 4px;color:#334155}
      .fechamento-block{margin-top:12px}
      .fechamento-title{font-weight:600;font-size:11px;margin:8px 0 4px;color:#475569}
      .table-wrapper{border:1px solid #cbd5e0;overflow:hidden;margin-top:4px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border-bottom:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      th{background:#edf2f7;font-size:11px}
      .totals-row td{font-weight:600;background:#fffbea}
      .totals-label{text-align:right;padding-right:12px}
      .unit-total-row{margin-top:12px;border:1px solid #cbd5e0;padding:8px 12px;background:#e2e8f0;font-size:11px;font-weight:600;display:flex;flex-wrap:wrap;gap:12px}
      .totals-summary{margin-top:20px;border:1px solid #cbd5e0;padding:12px 16px;background:#f7fafc;display:flex;flex-wrap:wrap;gap:16px;font-size:11px}
      footer{position:fixed;bottom:12px;left:20px;right:20px;text-align:right;font-size:10px;color:#4a5568}
      @media print{.print-actions{display:none}body{margin:0 20px 80px}}
    `;

    popup.document.write(`
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${reportDocumentTitle}</title><style>${styles}</style></head>
      <body>
        <div class="print-actions"><button onclick="window.print()">Imprimir PDF</button></div>
        <header class="report-header">
          <div class="logo-area">${logoHtml}</div>
          <div class="title-area"><h1>${reportTitle}</h1></div>
          <div class="header-spacer">&nbsp;</div>
        </header>
        ${tabelasPorUnidade}
        <div class="totals-summary">
          <div><strong>Total Valor Custo:</strong> ${this.formatCurrency(totalValorFechamento)}</div>
          <div><strong>Total Valor Venda:</strong> ${this.formatCurrency(totalValorRecebido)}</div>
          <div><strong>Total Valor Lucro:</strong> ${this.formatCurrency(totalValorLucro)}</div>
          <div><strong>% Lucro:</strong> ${totalPct}</div>
        </div>
        <footer>${geradoEm}</footer>
      </body></html>
    `);
    popup.document.close();
    popup.document.title = reportDocumentTitle;
    popup.focus();
  }

  /** Resumo por vendedor, quebrado por unidade: Unidade -> (nome vendedor, total custo, total venda, valor lucro, % lucro). */
  imprimirPorVendedor(): void {
    const vendas = this.getSelectedVendaModels();
    if (vendas.length === 0) {
      this.errorModalService.show('Selecione ao menos uma venda para imprimir.', 'Aviso');
      return;
    }
    const popup = window.open('', '_blank', 'width=1024,height=768');
    if (!popup) {
      this.errorModalService.show('Não foi possível abrir a janela de impressão. Verifique bloqueadores de pop-up.', 'Erro');
      return;
    }

    const reportTitle = 'Análise de Valores - por Vendedor';
    const reportTimestamp = this.getReportTimestamp();
    const reportDocumentTitle = `Relatório - ${reportTitle} ${reportTimestamp}`;
    const user = this.authService.getCurrentUser();
    const usuarioLabel = user?.nome || user?.email || 'Usuário';
    const now = new Date();
    const geradoEm = `Gerado em ${now.toLocaleDateString('pt-BR')}, ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} por ${usuarioLabel}`;
    const logoUrl = this.getLogoRelatorioUrl();
    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : '';

    type ResumoVendedor = { totalCusto: number; totalVenda: number };
    const unidadeMap = new Map<string, Map<string, ResumoVendedor>>();

    vendas.forEach((v) => {
      const un = v.unidade || 'Não informado';
      const vendedorNome = this.getVendedorNome(v) || '-';
      const custo = v.valorPago ?? 0;
      const venda = v.valorCliente ?? 0;
      if (!unidadeMap.has(un)) unidadeMap.set(un, new Map());
      const vendedorMap = unidadeMap.get(un)!;
      if (!vendedorMap.has(vendedorNome)) {
        vendedorMap.set(vendedorNome, { totalCusto: 0, totalVenda: 0 });
      }
      const r = vendedorMap.get(vendedorNome)!;
      r.totalCusto += custo;
      r.totalVenda += venda;
    });

    const unidadesOrdenadas = Array.from(unidadeMap.keys()).sort((a, b) => {
      if (a === 'Não informado') return 1;
      if (b === 'Não informado') return -1;
      return a.localeCompare(b);
    });

    const secoes = unidadesOrdenadas.map((unidade) => {
      const vendedorMap = unidadeMap.get(unidade)!;
      const vendedoresComPct = Array.from(vendedorMap.entries()).map(([nomeVendedor, resumo]) => {
        const lucro = resumo.totalVenda - resumo.totalCusto;
        const pctNum = resumo.totalCusto > 0 ? (lucro / resumo.totalCusto) * 100 : -1;
        return { nomeVendedor, resumo, lucro, pctNum };
      });
      vendedoresComPct.sort((a, b) => b.pctNum - a.pctNum);
      const linhas = vendedoresComPct.map((item, idx) => {
        const pct = item.pctNum >= 0 ? `${Number(item.pctNum.toFixed(1))}%` : '-';
        return `<tr>
          <td>${idx + 1}</td>
          <td>${item.nomeVendedor}</td>
          <td>${this.formatCurrency(item.resumo.totalCusto)}</td>
          <td>${this.formatCurrency(item.resumo.totalVenda)}</td>
          <td>${this.formatCurrency(item.lucro)}</td>
          <td>${pct}</td>
        </tr>`;
      }).join('');

      return `<section class="unit-section">
        <div class="unit-title">Unidade: ${unidade}</div>
        <div class="table-wrapper">
          <table>
            <thead><tr>
              <th>#</th><th>Vendedor</th><th>Total Custo</th><th>Total Venda</th><th>Valor Lucro</th><th>% Lucro</th>
            </tr></thead>
            <tbody>${linhas}</tbody>
          </table>
        </div>
      </section>`;
    }).join('');

    const styles = `
      body{font-family:'Segoe UI',Arial,sans-serif;margin:16px;color:#1a202c;font-size:12px;background:#fff;margin-bottom:80px}
      h1{margin:0;font-size:20px}
      .print-actions{text-align:right;margin-bottom:12px}
      .print-actions button{background:#2b6cb0;color:#fff;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-size:11px}
      .report-header{display:flex;align-items:center;gap:16px;margin-bottom:8px}
      .logo-area,.header-spacer{flex:0 0 220px}
      .header-spacer{visibility:hidden}
      .logo-area img{max-height:60px}
      .title-area{flex:1;text-align:center}
      .unit-section{margin-top:24px;page-break-inside:avoid}
      .unit-title{font-weight:600;text-transform:uppercase;font-size:12px;margin-bottom:6px;color:#1e293b}
      .table-wrapper{border:1px solid #cbd5e0;overflow:hidden;margin-top:4px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border-bottom:1px solid #e2e8f0;padding:6px 8px;text-align:left}
      th{background:#edf2f7;font-size:11px}
      footer{position:fixed;bottom:12px;left:20px;right:20px;text-align:right;font-size:10px;color:#4a5568}
      @media print{.print-actions{display:none}body{margin:0 20px 80px}}
    `;

    popup.document.write(`
      <!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>${reportDocumentTitle}</title><style>${styles}</style></head>
      <body>
        <div class="print-actions"><button onclick="window.print()">Imprimir PDF</button></div>
        <header class="report-header">
          <div class="logo-area">${logoHtml}</div>
          <div class="title-area"><h1>${reportTitle}</h1></div>
          <div class="header-spacer">&nbsp;</div>
        </header>
        ${secoes}
        <footer>${geradoEm}</footer>
      </body></html>
    `);
    popup.document.close();
    popup.document.title = reportDocumentTitle;
    popup.focus();
  }

  async exportarExcel(): Promise<void> {
    const vendas = this.getSelectedVendaModels();
    if (vendas.length === 0) {
      this.errorModalService.show('Selecione ao menos uma venda para exportar.', 'Aviso');
      return;
    }
    const rows = vendas.map((v) => {
      const valorFechamento = v.valorPago ?? 0;
      const valorRecebido = v.valorCliente ?? 0;
      const valorLucro = valorRecebido - valorFechamento;
      const pctLucro = valorFechamento > 0 ? (valorLucro / valorFechamento) * 100 : 0;
      const linha: Record<string, string | number> = {
        Protocolo: v.protocolo,
        'Data Venda': this.formatDate(v.dataVenda),
        Cliente: this.getClienteNome(v),
        Vendedor: this.getVendedorNome(v),
        'Valor Custo': valorFechamento,
        'Valor Venda': valorRecebido,
        'Valor Lucro': valorLucro,
        '% Lucro': valorFechamento > 0 ? Number(pctLucro.toFixed(1)) : '-',
        Status: this.getStatusLabel(v.status),
      };
      return linha;
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Análise de Valores');
    if (rows.length > 0) {
      ws.columns = Object.keys(rows[0]).map((h) => ({ header: h, key: h }));
      rows.forEach((r) => ws.addRow(r));
    }
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Analise_Valores_${this.getReportTimestamp().replace(/[:\s]/g, '-')}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
