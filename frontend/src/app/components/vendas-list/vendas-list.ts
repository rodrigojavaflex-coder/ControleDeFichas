import { Component, OnInit, inject, ViewEncapsulation, ChangeDetectorRef, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Subject } from 'rxjs';
import { VendaService } from '../../services/vendas.service';
import { BaixasService } from '../../services/baixas.service';
import { AuthService } from '../../services/auth.service';
import { ConfiguracaoService } from '../../services/configuracao.service';
import { Venda, VendaPaginatedResponse, FindVendasDto, VendaOrigem, VendaStatus, Unidade } from '../../models/venda.model';
import { Baixa, TipoDaBaixa, ProcessarBaixasEmMassaResultado } from '../../models/baixa.model';
import * as XLSX from 'xlsx';
import { Permission } from '../../models/usuario.model';
import { BaseListComponent } from '../base-list.component';
import { VendaModalComponent } from '../venda-modal/venda-modal';
import { HistoricoAuditoriaComponent } from '../historico-auditoria/historico-auditoria.component';
import { LancarBaixaModalComponent } from '../lancar-baixa-modal/lancar-baixa-modal';
import { Configuracao } from '../../models/configuracao.model';
import { environment } from '../../../environments/environment';
import { PageContextService } from '../../services/page-context.service';
import { catchError, map, takeUntil } from 'rxjs/operators';

type SortDirection = 'asc' | 'desc';
type SortableField =
  | 'protocolo'
  | 'dataVenda'
  | 'dataFechamento'
  | 'cliente'
  | 'origem'
  | 'vendedor'
  | 'ativo'
  | 'valorCompra'
  | 'valorCliente'
  | 'valorPago'
  | 'status'
  | 'observacao';

interface AppliedFilter {
  key: string;
  label: string;
  value: string;
}

interface VendasFilterSnapshot {
  protocolo: string;
  cliente: string;
  vendedor: string;
  origem: string;
  status: string;
  ativo: string;
  dataInicial: string;
  dataFinal: string;
  dataInicialFechamento: string;
  dataFinalFechamento: string;
  unidade: string;
}

@Component({
  selector: 'app-vendas-list',
  standalone: true,
  imports: [CommonModule, FormsModule, VendaModalComponent, HistoricoAuditoriaComponent, LancarBaixaModalComponent],
  templateUrl: './vendas-list.html',
  styleUrls: ['./vendas-list.css'],
  encapsulation: ViewEncapsulation.None
})
export class VendasListComponent extends BaseListComponent<Venda> implements OnDestroy {
  private vendaService = inject(VendaService);
  private baixasService = inject(BaixasService);
  private authService = inject(AuthService);
  private configuracaoService = inject(ConfiguracaoService);
  private cdr = inject(ChangeDetectorRef);
  private pageContextService = inject(PageContextService);
  configuracao: Configuracao | null = null;

  // Paginação
  currentPage = 1;
  pageSize = 150;
  totalItems = 0;
  totalPages = 0;

  // Filtros
  protocoloFilter = '';
  clienteFilter = '';
  vendedorFilter = '';
  origemFilter: VendaOrigem | '' = '';
  statusFilter: VendaStatus | '' = '';
  dataInicialFilter = '';
  dataFinalFilter = '';
  dataInicialFechamentoFilter = '';
  dataFinalFechamentoFilter = '';
  unidadeFilter: Unidade | '' = '';
  ativoFilter = '';
  unidadeDisabled = false;
  private appliedFiltersSnapshot: VendasFilterSnapshot = this.createFilterSnapshot();

  // Storage key para persistência de filtros
  private readonly FILTERS_STORAGE_KEY = 'vendas_list_filters';

  // Nova venda (para registro direto na lista)
  novaVenda: Partial<Venda> = {
    protocolo: '',
    dataVenda: new Date().toISOString().split('T')[0], // Data atual
    cliente: '',
    origem: VendaOrigem.GOIANIA,
    vendedor: '',
    valorCompra: 0,
    valorCliente: 0,
    observacao: '',
    status: VendaStatus.REGISTRADO
  };

  // Estados
  showNewRow = false;
  editingId: string | null = null;
  editingVenda: Partial<Venda> = {};
  selectedVendas: Set<string> = new Set();
  baixasCache: Map<string, Baixa[]> = new Map();
  fechamentoLoading = false;
  cancelamentoLoading = false;
  filtersPanelOpen = false;
  sortField: SortableField | null = null;
  sortDirection: SortDirection = 'asc';
  TipoDaBaixa = TipoDaBaixa;
  tiposBaixa = Object.values(TipoDaBaixa);
  massBaixaAllowedStatuses: VendaStatus[] = [VendaStatus.REGISTRADO, VendaStatus.PAGO_PARCIAL];
  showMassBaixaModal = false;
  massBaixaLoading = false;
  massBaixaForm: { tipoDaBaixa: TipoDaBaixa; dataBaixa: string; observacao: string } =
    this.getDefaultMassBaixaForm();

  // Modal de venda
  showVendaModal = false;
  selectedVenda: Venda | null = null;

  // Modal de auditoria
  showAuditModal = false;
  selectedVendaForAudit: Venda | null = null;

  // Modal de lançar baixa
  showBaixaModal = false;
  selectedVendaForBaixa: Venda | null = null;
  showBulkDeleteModal = false;
  bulkDeleteLoading = false;
  contextMenuVisible = false;
  contextMenuPosition = { x: 0, y: 0 };
  contextMenuVenda: Venda | null = null;
  private destroy$ = new Subject<void>();

  // Enums para template
  VendaOrigem = VendaOrigem;
  VendaStatus = VendaStatus;
  Unidade = Unidade;
  unidades = Object.values(Unidade);
  Permission = Permission;

  /** Título do modal de confirmação de exclusão */
  deleteModalTitle = 'Confirmação de Exclusão';

  override ngOnInit(): void {
    this.restoreFiltersFromStorage();
    this.initializeDateFilters();
    this.initializeUnidadeFilter();
    this.appliedFiltersSnapshot = this.createFilterSnapshot();
    this.configuracaoService.getConfiguracao().subscribe({
      next: config => (this.configuracao = config),
      error: () => (this.configuracao = null)
    });
    this.pageContextService.setContext({
      title: 'Vendas',
      description: 'Visualize e gerencie as vendas registradas, acompanhe status e totais rapidamente.'
    });
    super.ngOnInit();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.pageContextService.resetContext();
    this.closeContextMenu();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onWindowChange(): void {
    if (this.contextMenuVisible) {
      this.closeContextMenu();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.contextMenuVisible) {
      this.closeContextMenu();
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.contextMenuVisible) {
      this.closeContextMenu();
    }
  }

  private restoreFiltersFromStorage(): void {
    try {
      const savedFilters = localStorage.getItem(this.FILTERS_STORAGE_KEY);
      if (savedFilters) {
        const filters = JSON.parse(savedFilters);
        this.protocoloFilter = filters.protocoloFilter || '';
        this.clienteFilter = filters.clienteFilter || '';
        this.vendedorFilter = filters.vendedorFilter || '';
        this.origemFilter = filters.origemFilter || '';
        this.statusFilter = filters.statusFilter || '';
        this.dataInicialFilter = filters.dataInicialFilter || '';
        this.dataFinalFilter = filters.dataFinalFilter || '';
        this.dataInicialFechamentoFilter = filters.dataInicialFechamentoFilter || '';
        this.dataFinalFechamentoFilter = filters.dataFinalFechamentoFilter || '';
        this.unidadeFilter = filters.unidadeFilter || '';
        this.ativoFilter = filters.ativoFilter || '';
        this.currentPage = filters.currentPage || 1;
      }
    } catch (error) {
      console.error('Erro ao restaurar filtros do localStorage:', error);
    }
  }

  private saveFiltersToStorage(): void {
    try {
      const filters = {
        protocoloFilter: this.protocoloFilter,
        clienteFilter: this.clienteFilter,
        vendedorFilter: this.vendedorFilter,
        origemFilter: this.origemFilter,
        statusFilter: this.statusFilter,
        dataInicialFilter: this.dataInicialFilter,
        dataFinalFilter: this.dataFinalFilter,
        dataInicialFechamentoFilter: this.dataInicialFechamentoFilter,
        dataFinalFechamentoFilter: this.dataFinalFechamentoFilter,
        unidadeFilter: this.unidadeFilter,
        ativoFilter: this.ativoFilter,
        currentPage: this.currentPage
      };
      localStorage.setItem(this.FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.error('Erro ao salvar filtros no localStorage:', error);
    }
  }

  private initializeDateFilters(): void {
    // Se os filtros já estão preenchidos, não sobrescreva
    if (this.dataInicialFilter && this.dataFinalFilter) {
      return;
    }

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    // Usar data local ao invés de UTC
    const formatDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    this.dataInicialFilter = formatDate(firstDay);
    this.dataFinalFilter = formatDate(lastDay);
  }

  private initializeUnidadeFilter(): void {
    const currentUser = this.authService.getCurrentUser();
    // Verificar se unidade existe e não é vazia
    if (currentUser?.unidade && currentUser.unidade.trim() !== '') {
      this.unidadeFilter = currentUser.unidade as Unidade;
      this.unidadeDisabled = true;
    } else {
      this.unidadeDisabled = false;
      this.unidadeFilter = '';
    }
  }

  private getLogoRelatorioUrl(): string | null {
    if (!this.configuracao?.logoRelatorio) {
      return null;
    }

    const backendUrl = environment.apiUrl.replace(/\/api$/, '');
    return this.configuracao.logoRelatorio.startsWith('/uploads')
      ? backendUrl + this.configuracao.logoRelatorio
      : this.configuracao.logoRelatorio;
  }

  protected override loadItems(): void {
    this.loading = true;
    this.error = '';

    const filters: FindVendasDto = { page: this.currentPage, limit: this.pageSize };

    if (this.protocoloFilter.trim()) {
      filters.protocolo = this.protocoloFilter.trim();
    }

    if (this.clienteFilter.trim()) {
      filters.cliente = this.clienteFilter.trim();
    }

    if (this.vendedorFilter.trim()) {
      filters.vendedor = this.vendedorFilter.trim();
    }

    if (this.origemFilter) {
      filters.origem = this.origemFilter as VendaOrigem;
    }

    if (this.statusFilter) {
      filters.status = this.statusFilter as VendaStatus;
    }

    if (this.dataInicialFilter) {
      filters.dataInicial = this.dataInicialFilter;
    }

    if (this.dataFinalFilter) {
      filters.dataFinal = this.dataFinalFilter;
    }

    if (this.dataInicialFechamentoFilter) {
      filters.dataInicialFechamento = this.dataInicialFechamentoFilter;
    }

    if (this.dataFinalFechamentoFilter) {
      filters.dataFinalFechamento = this.dataFinalFechamentoFilter;
    }

    if (this.unidadeFilter) {
      filters.unidade = this.unidadeFilter as Unidade;
    }

    if (this.ativoFilter.trim()) {
      filters.ativo = this.ativoFilter.trim();
    }

    this.vendaService.getVendas(filters).subscribe({
      next: (response: VendaPaginatedResponse) => {
        this.items = response.data;
        this.totalItems = response.meta.total;
        this.totalPages = response.meta.totalPages;
        this.applySorting();
        this.loading = false;
      },
      error: (_: any) => {
        this.loading = false;
        this.errorModalService.show('Erro ao carregar vendas', 'Erro');
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.saveFiltersToStorage();
    this.selectedVendas.clear();
    this.loadItems();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.selectedVendas.clear();
    this.saveFiltersToStorage();
    this.loadItems();
  }

  toggleFiltersVisibility(): void {
    this.filtersPanelOpen = !this.filtersPanelOpen;
  }

  editSelectedVenda(): void {
    if (!this.canEditVenda()) {
      return;
    }
    const venda = this.getSingleSelectedVenda(
      'Selecione uma venda para editar.',
      'Selecione apenas uma venda para editar.'
    );
    if (!venda) {
      return;
    }
    this.openEditVendaModal(venda);
  }

  lancarBaixaSelecionada(): void {
    if (!this.canLancarBaixa()) {
      return;
    }
    if (this.selectedVendas.size === 0) {
      this.errorModalService.show('Selecione ao menos uma venda para lançar baixa.', 'Atenção');
      return;
    }

    if (this.selectedVendas.size > 1) {
      this.openMassBaixaModal();
      return;
    }

    const venda = this.getSingleSelectedVenda(
      'Selecione uma venda para lançar baixa.',
      'Selecione apenas uma venda para lançar baixa.'
    );
    if (!venda) {
      return;
    }
    this.openBaixaModal(venda);
  }

  openMassBaixaModal(): void {
    this.massBaixaForm = this.getDefaultMassBaixaForm();
    this.showMassBaixaModal = true;
  }

  closeMassBaixaModal(): void {
    if (this.massBaixaLoading) {
      return;
    }
    this.showMassBaixaModal = false;
  }

  processarBaixasEmMassa(): void {
    if (this.massBaixaLoading) {
      return;
    }

    if (this.selectedVendas.size < 2) {
      this.errorModalService.show('Selecione ao menos duas vendas para processamento em massa.', 'Atenção');
      return;
    }

    if (!this.massBaixaForm.dataBaixa) {
      this.errorModalService.show('Informe a data da baixa para continuar.', 'Validação');
      return;
    }

    const payload = {
      vendaIds: Array.from(this.selectedVendas),
      tipoDaBaixa: this.massBaixaForm.tipoDaBaixa,
      dataBaixa: this.massBaixaForm.dataBaixa,
      observacao: this.massBaixaForm.observacao?.trim() || undefined
    };

    this.massBaixaLoading = true;
    this.baixasService.processarBaixasEmMassa(payload).subscribe({
      next: (resultado) => this.onMassBaixaProcessed(resultado),
      error: (error) => {
        this.massBaixaLoading = false;
        const message = error.error?.message || 'Erro ao processar baixas em massa.';
        this.errorModalService.show(message, 'Erro');
      }
    });
  }

  private onMassBaixaProcessed(resultado: ProcessarBaixasEmMassaResultado): void {
    this.massBaixaLoading = false;
    this.showMassBaixaModal = false;
    this.massBaixaForm = this.getDefaultMassBaixaForm();
    this.baixasCache.clear();
    this.selectedVendas.clear();
    this.loadItems();

    let message = `${resultado.sucesso.length} baixa(s) processadas com sucesso.`;
    let title = 'Sucesso';

    if (resultado.falhas.length) {
      const detalhes = resultado.falhas
        .map(falha => `${falha.protocolo || falha.idvenda}: ${falha.motivo}`)
        .join('\n');
      message += `\n\nNão foi possível processar ${resultado.falhas.length} venda(s):\n${detalhes}`;
      title = 'Processamento concluído com avisos';
    }

    this.errorModalService.show(message, title);
  }

  abrirAuditoriaVendaSelecionada(): void {
    if (!this.canAuditVenda()) {
      return;
    }
    const venda = this.getSingleSelectedVenda(
      'Selecione uma venda para ver o histórico de auditoria.',
      'Selecione apenas uma venda para ver o histórico.'
    );
    if (!venda) {
      return;
    }
    this.openAuditHistory(venda);
  }

  onRowClick(event: MouseEvent, vendaId: string): void {
    const target = event.target as HTMLElement;
    const interactiveSelectors = ['button', 'a', 'input', 'select', 'textarea', '[role="button"]'];
    if (target.closest(interactiveSelectors.join(','))) {
      return;
    }
    this.toggleSelectVenda(vendaId);
    this.closeContextMenu();
  }

  onRowContextMenu(event: MouseEvent, venda: Venda): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuVenda = venda;
    this.contextMenuVisible = true;
    const menuWidth = 220;
    const menuHeight = 240;
    let x = event.clientX;
    let y = event.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 8;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 8;
    }

    this.contextMenuPosition = { x, y };

    if (!this.isVendaSelected(venda.id)) {
      this.selectedVendas.clear();
      this.selectedVendas.add(venda.id);
    }
  }

  closeContextMenu(): void {
    this.contextMenuVisible = false;
    this.contextMenuVenda = null;
  }

  private createFilterSnapshot(): VendasFilterSnapshot {
    return {
      protocolo: this.protocoloFilter || '',
      cliente: this.clienteFilter || '',
      vendedor: this.vendedorFilter || '',
      origem: this.origemFilter?.toString() || '',
      status: this.statusFilter?.toString() || '',
      ativo: this.ativoFilter || '',
      dataInicial: this.dataInicialFilter || '',
      dataFinal: this.dataFinalFilter || '',
      dataInicialFechamento: this.dataInicialFechamentoFilter || '',
      dataFinalFechamento: this.dataFinalFechamentoFilter || '',
      unidade: this.unidadeFilter?.toString() || ''
    };
  }

  private updateAppliedFiltersSnapshot(): void {
    this.appliedFiltersSnapshot = this.createFilterSnapshot();
  }

  onFiltersToggleKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleFiltersVisibility();
    }
  }

  clearFilters(): void {
    this.protocoloFilter = '';
    this.clienteFilter = '';
    this.vendedorFilter = '';
    this.origemFilter = '';
    this.statusFilter = '';
    this.ativoFilter = '';
    
    // Reinicializa filtros de data para o mês atual
    this.dataInicialFilter = '';
    this.dataFinalFilter = '';
    this.dataInicialFechamentoFilter = '';
    this.dataFinalFechamentoFilter = '';
    this.initializeDateFilters();
    
    // Reinicializa filtro de unidade apenas se não estiver bloqueado
    if (!this.unidadeDisabled) {
      this.unidadeFilter = '';
    }
    
    this.currentPage = 1;
    this.selectedVendas.clear();
    this.saveFiltersToStorage();
    this.filtersPanelOpen = false;
    this.updateAppliedFiltersSnapshot();
    this.loadItems();
  }

  get appliedFilters(): AppliedFilter[] {
    const filters: AppliedFilter[] = [];
    const snapshot = this.appliedFiltersSnapshot;
    if (snapshot.protocolo.trim()) {
      filters.push({ key: 'protocolo', label: 'Protocolo', value: snapshot.protocolo.trim() });
    }
    if (snapshot.cliente.trim()) {
      filters.push({ key: 'cliente', label: 'Cliente', value: snapshot.cliente.trim() });
    }
    if (snapshot.vendedor.trim()) {
      filters.push({ key: 'vendedor', label: 'Vendedor', value: snapshot.vendedor.trim() });
    }
    if (snapshot.ativo.trim()) {
      filters.push({ key: 'ativo', label: 'Ativo', value: snapshot.ativo.trim() });
    }
    if (snapshot.origem) {
      filters.push({ key: 'origem', label: 'Comprado em', value: this.getOrigemLabel(snapshot.origem as VendaOrigem) });
    }
    if (snapshot.status) {
      filters.push({ key: 'status', label: 'Status', value: this.getStatusLabel(snapshot.status as VendaStatus) });
    }
    if (snapshot.dataInicial || snapshot.dataFinal) {
      const from = snapshot.dataInicial ? this.formatDate(snapshot.dataInicial) : '';
      const to = snapshot.dataFinal ? this.formatDate(snapshot.dataFinal) : '';
      let value = '';
      if (from && to) {
        value = `${from} a ${to}`;
      } else if (from) {
        value = `A partir de ${from}`;
      } else if (to) {
        value = `Até ${to}`;
      }
      filters.push({ key: 'dataVenda', label: 'Data da Venda', value });
    }
    if (snapshot.dataInicialFechamento || snapshot.dataFinalFechamento) {
      const from = snapshot.dataInicialFechamento ? this.formatDate(snapshot.dataInicialFechamento) : '';
      const to = snapshot.dataFinalFechamento ? this.formatDate(snapshot.dataFinalFechamento) : '';
      let value = '';
      if (from && to) {
        value = `${from} a ${to}`;
      } else if (from) {
        value = `A partir de ${from}`;
      } else if (to) {
        value = `Até ${to}`;
      }
      filters.push({ key: 'dataFechamento', label: 'Data de Fechamento', value });
    }
    if (snapshot.unidade) {
      filters.push({ key: 'unidade', label: 'Unidade', value: snapshot.unidade });
    }
    return filters.filter(filter => filter.value);
  }

  clearAppliedFilter(key: string): void {
    switch (key) {
      case 'protocolo':
        this.protocoloFilter = '';
        break;
      case 'cliente':
        this.clienteFilter = '';
        break;
      case 'vendedor':
        this.vendedorFilter = '';
        break;
      case 'ativo':
        this.ativoFilter = '';
        break;
      case 'origem':
        this.origemFilter = '';
        break;
      case 'status':
        this.statusFilter = '';
        break;
      case 'dataVenda':
        this.dataInicialFilter = '';
        this.dataFinalFilter = '';
        break;
      case 'dataFechamento':
        this.dataInicialFechamentoFilter = '';
        this.dataFinalFechamentoFilter = '';
        break;
      case 'unidade':
        if (!this.unidadeDisabled) {
          this.unidadeFilter = '';
        }
        break;
      default:
        return;
    }
    this.updateAppliedFiltersSnapshot();
    this.onFilterChange();
  }

  applyFilters(): void {
    this.filtersPanelOpen = false;
    this.updateAppliedFiltersSnapshot();
    this.onFilterChange();
  }

  onSort(field: SortableField): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.applySorting();
  }

  private applySorting(): void {
    if (!this.sortField) {
      return;
    }
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

      return valueA.toString().localeCompare(valueB.toString(), 'pt-BR', {
        sensitivity: 'base',
        numeric: true
      }) * direction;
    });
  }

  private getSortableValue(venda: Venda, field: SortableField): any {
    switch (field) {
      case 'protocolo':
        return venda.protocolo;
      case 'dataVenda':
        return venda.dataVenda ? new Date(venda.dataVenda).getTime() : null;
      case 'dataFechamento':
        return venda.dataFechamento ? new Date(venda.dataFechamento).getTime() : null;
      case 'cliente':
        return venda.cliente;
      case 'origem':
        return this.getOrigemLabel(venda.origem);
      case 'vendedor':
        return venda.vendedor;
      case 'ativo':
        return venda.ativo;
      case 'valorCompra':
        return venda.valorCompra || 0;
      case 'valorCliente':
        return venda.valorCliente || 0;
      case 'valorPago':
        return this.getValorBaixadoForVenda(venda.id);
      case 'status':
        return this.getStatusLabel(venda.status);
      case 'observacao':
        return venda.observacao || '';
      default:
        return venda.protocolo;
    }
  }

  private getSingleSelectedVenda(noSelectionMsg: string, multipleSelectionMsg: string): Venda | null {
    if (this.selectedVendas.size === 0) {
      this.errorModalService.show(noSelectionMsg, 'Atenção');
      return null;
    }

    if (this.selectedVendas.size > 1) {
      this.errorModalService.show(multipleSelectionMsg, 'Atenção');
      return null;
    }

    const vendaId = Array.from(this.selectedVendas)[0];
    const venda = this.items.find(item => item.id === vendaId);

    if (!venda) {
      this.errorModalService.show('Venda selecionada não encontrada na lista.', 'Atenção');
      return null;
    }

    return venda;
  }

  openBulkDeleteModal(): void {
    if (!this.canDeleteVenda()) {
      return;
    }

    if (this.selectedVendas.size === 0) {
      this.errorModalService.show('Selecione pelo menos uma venda para excluir.', 'Atenção');
      return;
    }

    this.showBulkDeleteModal = true;
  }

  closeBulkDeleteModal(): void {
    if (this.bulkDeleteLoading) {
      return;
    }
    this.showBulkDeleteModal = false;
  }

  confirmBulkDelete(): void {
    if (this.selectedVendas.size === 0) {
      this.errorModalService.show('Selecione pelo menos uma venda para excluir.', 'Atenção');
      this.closeBulkDeleteModal();
      return;
    }

    if (this.selectedVendas.size === 0) {
      this.errorModalService.show('Selecione pelo menos uma venda para fechar.', 'Atenção');
      return;
    }

    const ids = Array.from(this.selectedVendas);
    this.bulkDeleteLoading = true;

    const deleteRequests = ids.map(id =>
      this.vendaService.deleteVenda(id).pipe(
        map(() => ({ id, error: null })),
        catchError(error => of({ id, error }))
      )
    );

    forkJoin(deleteRequests)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
      next: results => {
        const failed = results.filter(result => !!result.error);
        this.bulkDeleteLoading = false;
        this.showBulkDeleteModal = false;
        if (failed.length > 0) {
          const detalhes = failed
            .map(result => {
              const venda = this.items.find(item => item.id === result.id);
              const protocolo = venda?.protocolo || result.id;
              const motivo = result.error?.error?.message || result.error?.message || 'Erro desconhecido';
              return `• Protocolo ${protocolo}: ${motivo}`;
            })
            .join('\n');
          this.errorModalService.show(
            `Algumas vendas não puderam ser excluídas:\n${detalhes}`,
            'Erro ao excluir'
          );
        } else {
          this.errorModalService.show('Vendas excluídas com sucesso.', 'Sucesso');
        }
        this.selectedVendas.clear();
        this.loadItems();
      },
      error: () => {
        this.bulkDeleteLoading = false;
        this.errorModalService.show('Erro ao excluir vendas selecionadas.', 'Erro');
      }
    });
  }

  // Métodos para registro direto na lista
  showNewVendaRow(): void {
    this.showNewRow = true;
    this.novaVenda = {
      protocolo: '',
      dataVenda: new Date().toISOString().split('T')[0],
      cliente: '',
      origem: VendaOrigem.GOIANIA,
      vendedor: '',
      valorCompra: 0,
      valorCliente: 0,
      observacao: '',
      status: VendaStatus.REGISTRADO
    };
  }

  cancelNewVenda(): void {
    this.showNewRow = false;
    this.novaVenda = {};
  }

  saveNewVenda(): void {
    if (!this.novaVenda.protocolo || !this.novaVenda.cliente || !this.novaVenda.vendedor) {
      this.errorModalService.show('Preencha todos os campos obrigatórios', 'Erro de Validação');
      return;
    }

    this.loading = true;
    this.vendaService.createVenda(this.novaVenda as any).subscribe({
      next: () => {
        this.showNewRow = false;
        this.novaVenda = {};
        this.loadItems();
      },
      error: (error: any) => {
        this.loading = false;
        const message = error.error?.message || 'Erro ao criar venda';
        this.errorModalService.show(message, 'Erro');
      }
    });
  }

  // Métodos para modal de venda
  openNewVendaModal(): void {
    this.selectedVenda = null;
    this.showVendaModal = true;
  }

  openEditVendaModal(venda: Venda): void {
    this.selectedVenda = venda;
    this.showVendaModal = true;
  }

  onVendaModalClose(): void {
    this.showVendaModal = false;
    this.selectedVenda = null;
  }

  onVendaSaved(venda: Venda) {
    if (this.selectedVenda) {
      // Atualizar venda existente na lista
      const index = this.items.findIndex((v: Venda) => v.id === venda.id);
      if (index !== -1) {
        this.items[index] = venda;
      }
    } else {
      // Adicionar nova venda à lista
      this.items.unshift(venda);
    }
    this.selectedVenda = null;
    this.showVendaModal = false;
  }

  deleteVenda(venda: Venda): void {
    this.confirmDelete(venda, `Tem certeza que deseja excluir a venda "${venda.protocolo}"?`);
  }

  protected override deleteItem(id: string) {
    return this.vendaService.deleteVenda(id);
  }

  protected override getId(item: Venda): string {
    return item.id;
  }

  // Métodos para verificar permissões
  canCreateVenda(): boolean {
    return this.authService.hasPermission(Permission.VENDA_CREATE);
  }

  canReadVenda(): boolean {
    return this.authService.hasPermission(Permission.VENDA_READ);
  }

  canEditVenda(): boolean {
    return this.authService.hasPermission(Permission.VENDA_UPDATE);
  }

  canDeleteVenda(): boolean {
    return this.authService.hasPermission(Permission.VENDA_DELETE);
  }

  canAuditVenda(): boolean {
    return this.authService.hasPermission(Permission.VENDA_AUDIT);
  }

  canLancarBaixa(venda?: Venda): boolean {
    // Verificar apenas permissão
    return this.authService.hasPermission(Permission.VENDA_BAIXAR);
  }

  canFecharVendas(): boolean {
    return this.authService.hasPermission(Permission.VENDA_FECHAR);
  }

  canCancelarFechamento(): boolean {
    return this.authService.hasPermission(Permission.VENDA_CANCELAR_FECHAMENTO);
  }

  canViewValorCompra(): boolean {
    return this.authService.hasPermission(Permission.VENDA_VIEW_VALOR_COMPRA);
  }

  private ensureContextSelection(): void {
    if (this.contextMenuVenda) {
      this.selectedVendas.clear();
      this.selectedVendas.add(this.contextMenuVenda.id);
    }
  }

  onContextEdit(): void {
    if (this.contextMenuVenda && this.canEditVenda()) {
      this.openEditVendaModal(this.contextMenuVenda);
    }
    this.closeContextMenu();
  }

  onContextBaixa(): void {
    if (this.contextMenuVenda && this.canLancarBaixa()) {
      this.openBaixaModal(this.contextMenuVenda);
    }
    this.closeContextMenu();
  }

  onContextFechar(): void {
    if (this.contextMenuVenda && this.canFecharVendas()) {
      this.ensureContextSelection();
      this.closeContextMenu();
      this.fecharVendasSelecionadas();
      return;
    }
    this.closeContextMenu();
  }

  onContextCancelarFechamento(): void {
    if (this.contextMenuVenda && this.canCancelarFechamento()) {
      this.ensureContextSelection();
      this.closeContextMenu();
      this.cancelarFechamentosSelecionados();
      return;
    }
    this.closeContextMenu();
  }

  onContextAuditoria(): void {
    if (this.contextMenuVenda && this.canAuditVenda()) {
      this.openAuditHistory(this.contextMenuVenda);
    }
    this.closeContextMenu();
  }

  onContextExcluir(): void {
    if (this.contextMenuVenda && this.canDeleteVenda()) {
      this.deleteVenda(this.contextMenuVenda);
    }
    this.closeContextMenu();
  }

  imprimirFechamentoAtual(): void {
    if (!this.canReadVenda()) {
      return;
    }

    const vendasParaImprimir = this.getSelectedVendaModels();
    if (vendasParaImprimir.length === 0) {
      this.errorModalService.show('Selecione ao menos uma venda para imprimir.', 'Aviso');
      return;
    }

    const popup = window.open('', '_blank', 'width=1024,height=768');
    if (!popup) {
      this.errorModalService.show(
        'Não foi possível abrir a janela de impressão. Verifique bloqueadores de pop-up.',
        'Erro'
      );
      return;
    }
    const reportTitle = 'Relatório de Vendas';
    const reportTimestamp = this.getReportTimestamp();
    const reportDocumentTitle = `${reportTitle} ${reportTimestamp}`;

    const currentUser = this.authService.getCurrentUser();
    const usuarioLabel = currentUser?.nome || currentUser?.email || 'Usuário não identificado';
    const dataGeracao = new Date();
    const dataFormatada = dataGeracao.toLocaleDateString('pt-BR');
    const horaFormatada = dataGeracao.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const geradoEmTexto = `Gerado em ${dataFormatada}, ${horaFormatada} por ${usuarioLabel}`;

    const logoUrl = this.getLogoRelatorioUrl();
    const logoHtml = logoUrl ? `<img src="${logoUrl}" alt="Logo do sistema" />` : '';
    const podeVerValorCompra = this.canViewValorCompra();

    const totalValorCompra = podeVerValorCompra
      ? vendasParaImprimir.reduce((total, venda) => total + (venda.valorCompra || 0), 0)
      : 0;
    const totalValorCliente = vendasParaImprimir.reduce((total, venda) => total + (venda.valorCliente || 0), 0);
    const totalBaixas = vendasParaImprimir.reduce(
      (total, venda) => total + this.getValorBaixadoForVenda(venda.id),
      0
    );

    const unidadeMap = new Map<string, Map<string, Venda[]>>();
    vendasParaImprimir.forEach(venda => {
      const unidadeLabel = venda.unidade || 'Não informado';
      const origemLabel = this.getOrigemLabel(venda.origem);
      if (!unidadeMap.has(unidadeLabel)) {
        unidadeMap.set(unidadeLabel, new Map());
      }
      const origemMap = unidadeMap.get(unidadeLabel)!;
      if (!origemMap.has(origemLabel)) {
        origemMap.set(origemLabel, []);
      }
      origemMap.get(origemLabel)!.push(venda);
    });

    const unidadesOrdenadas = Array.from(unidadeMap.keys()).sort((a, b) => {
      if (a === 'Não informado') return 1;
      if (b === 'Não informado') return -1;
      return a.localeCompare(b);
    });

    let contador = 0;
    const tabelasPorUnidade = unidadesOrdenadas
      .map(unidade => {
        const origemMap = unidadeMap.get(unidade)!;
        const origensOrdenadas = Array.from(origemMap.keys()).sort((a, b) => a.localeCompare(b));
        let unidadeValorCompra = 0;
        let unidadeValorCliente = 0;
        let unidadeValorBaixas = 0;

        const origemBlocos = origensOrdenadas
          .map(origem => {
            const vendas = origemMap.get(origem)!;
            const origemValorCompra = podeVerValorCompra
              ? vendas.reduce((total, venda) => total + (venda.valorCompra || 0), 0)
              : 0;
            const origemValorCliente = vendas.reduce((total, venda) => total + (venda.valorCliente || 0), 0);
            const origemValorBaixas = vendas.reduce(
              (total, venda) => total + this.getValorBaixadoForVenda(venda.id),
              0
            );

            if (podeVerValorCompra) {
              unidadeValorCompra += origemValorCompra;
            }
            unidadeValorCliente += origemValorCliente;
            unidadeValorBaixas += origemValorBaixas;

            const linhasVendas = vendas
              .map(venda => {
                contador += 1;
                const valorCompraColuna = podeVerValorCompra
                  ? `<td>${this.formatCurrency(venda.valorCompra || 0)}</td>`
                  : '';
                return `
                  <tr>
                    <td>${contador}</td>
                    <td>${venda.protocolo}</td>
                    <td>${this.formatDate(venda.dataVenda)}</td>
                    <td>${venda.dataFechamento ? this.formatDate(venda.dataFechamento) : '-'}</td>
                    <td>${venda.cliente}</td>
                    <td>${venda.vendedor}</td>
                    ${valorCompraColuna}
                    <td>${this.formatCurrency(venda.valorCliente || 0)}</td>
                    <td>${this.formatCurrency(this.getValorBaixadoForVenda(venda.id))}</td>
                    <td>${this.getStatusLabel(venda.status)}</td>
                  </tr>`;
              })
              .join('');
            return `
              <div class="origem-block">
                <div class="origem-title">Comprado em: ${origem}</div>
                <div class="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Protocolo</th>
                        <th>Venda</th>
                        <th>Fechamento</th>
                        <th>Cliente</th>
                        <th>Vendedor</th>
                        ${podeVerValorCompra ? '<th>Compra</th>' : ''}
                        <th>Cliente</th>
                        <th>Pago</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${linhasVendas}
                      <tr class="totals-row origem-total">
                        <td class="totals-label" colspan="6">Total Comprado em ${origem}</td>
                        ${podeVerValorCompra ? `<td>${this.formatCurrency(origemValorCompra)}</td>` : ''}
                        <td>${this.formatCurrency(origemValorCliente)}</td>
                        <td>${this.formatCurrency(origemValorBaixas)}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>`;
          })
          .join('');

        return `
          <section class="unit-section">
            <div class="unit-title">Unidade: ${unidade}</div>
            ${origemBlocos}
            <div class="unit-total-row">
              <span>Total Unidade ${unidade}:</span>
              ${podeVerValorCompra ? `<span><strong>Valor Compra:</strong> ${this.formatCurrency(unidadeValorCompra)}</span>` : ''}
              <span><strong>Valor Cliente:</strong> ${this.formatCurrency(unidadeValorCliente)}</span>
              <span><strong>Total Pago:</strong> ${this.formatCurrency(unidadeValorBaixas)}</span>
            </div>
          </section>`;
      })
      .join('');

    popup.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
        <title>${reportDocumentTitle}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 16px; color: #1a202c; font-size: 12px; background: #fff; margin-bottom: 80px; }
            h1 { margin: 0; font-size: 20px; letter-spacing: 0.5px; }
            .print-actions { text-align: right; margin-bottom: 12px; }
            .print-actions button { background: #2b6cb0; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; }
            .report-header { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
            .logo-area,
            .header-spacer { flex: 0 0 220px; display: flex; align-items: center; justify-content: flex-start; }
            .header-spacer { visibility: hidden; }
            .logo-area img { max-height: 60px; width: auto; display: block; }
            .title-area { flex: 1 1 auto; text-align: center; }
            .unit-section { margin-top: 24px; page-break-inside: avoid; }
            .unit-section:first-of-type { margin-top: 0; }
            .unit-title { font-weight: 600; text-transform: uppercase; font-size: 12px; margin-bottom: 6px; color: #1e293b; }
            .origem-block { margin-top: 16px; }
            .origem-block:first-of-type { margin-top: 0; }
            .origem-title { font-weight: 600; text-transform: uppercase; font-size: 11px; margin: 12px 0 4px; color: #334155; }
            .table-wrapper { border: 1px solid #cbd5e0; border-radius: 0; overflow: hidden; margin-top: 4px; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 11px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
            tr:last-child td { border-bottom: none; }
            th { background: #edf2f7; font-size: 11px; }
            .totals-row td { font-weight: 600; background: #fffbea; }
            .totals-label { text-align: right; padding-right: 12px; }
            .origem-total td { border-top: 1px solid #cbd5e0; }
            .unit-total-row { margin-top: 12px; border: 1px solid #cbd5e0; padding: 8px 12px; background: #e2e8f0; font-size: 11px; font-weight: 600; text-transform: uppercase; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
            .totals-summary { margin-top: 20px; border: 1px solid #cbd5e0; border-radius: 0; padding: 12px 16px; background: #f7fafc; display: flex; flex-wrap: wrap; gap: 16px; font-size: 11px; width: 100%; box-sizing: border-box; }
            .totals-summary strong { margin-right: 4px; }
            footer { position: fixed; bottom: 12px; left: 20px; right: 20px; text-align: right; font-size: 10px; color: #4a5568; }
            @media print { .print-actions { display: none; } body { margin: 0 20px 80px; } }
          </style>
        </head>
        <body>
          <div class="print-actions">
            <button onclick="window.print()">Imprimir PDF</button>
          </div>
          <header class="report-header">
            <div class="logo-area">${logoHtml}</div>
            <div class="title-area">
              <h1>${reportTitle}</h1>
            </div>
            <div class="header-spacer">&nbsp;</div>
          </header>
          ${tabelasPorUnidade}
          <div class="totals-summary">
            ${podeVerValorCompra ? `<div><strong>Total Valor Compra:</strong> ${this.formatCurrency(totalValorCompra)}</div>` : ''}
            <div><strong>Total Valor Cliente:</strong> ${this.formatCurrency(totalValorCliente)}</div>
            <div><strong>Total Pago:</strong> ${this.formatCurrency(totalBaixas)}</div>
          </div>
          <footer>
            ${geradoEmTexto}
          </footer>
        </body>
      </html>
    `);
    popup.document.close();
    popup.document.title = reportDocumentTitle;
    popup.focus();
  }

  exportarSelecionadasParaExcel(): void {
    if (!this.canReadVenda()) {
      return;
    }

    if (this.selectedVendas.size === 0) {
      this.errorModalService.show('Selecione ao menos uma venda para exportar.', 'Aviso');
      return;
    }

    const vendas = this.getSelectedVendaModels();
    const podeVerValorCompra = this.canViewValorCompra();
    const planilha = vendas.map(venda => {
      const linha: Record<string, string | number> = {
        Protocolo: venda.protocolo,
        'Data Venda': this.formatDate(venda.dataVenda),
        'Data Fechamento': venda.dataFechamento ? this.formatDate(venda.dataFechamento) : '-',
        Cliente: venda.cliente,
        'Comprado em': this.getOrigemLabel(venda.origem),
        Vendedor: venda.vendedor,
        'Valor Cliente': venda.valorCliente || 0,
        'Valor Pago': this.getValorBaixadoForVenda(venda.id),
        Status: this.getStatusLabel(venda.status),
        Observação: venda.observacao || ''
      };

      if (podeVerValorCompra) {
        linha['Valor Compra'] = venda.valorCompra || 0;
      }

      return linha;
    });

    const worksheet = XLSX.utils.json_to_sheet(planilha);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendas');

    const nomeArquivo = `Relatorio_Vendas_${this.getReportTimestamp().replace(/[:\s]/g, '-')}.xlsx`;
    XLSX.writeFile(workbook, nomeArquivo);
  }

  /** Abrir modal de histórico de auditoria */
  openAuditHistory(venda: Venda): void {
    this.selectedVendaForAudit = venda;
    this.showAuditModal = true;
  }

  /** Fechar modal de auditoria */
  closeAuditModal(): void {
    this.showAuditModal = false;
    this.selectedVendaForAudit = null;
  }

  /** Abrir modal de lançar baixa */
  openBaixaModal(venda: Venda): void {
    this.selectedVendaForBaixa = venda;
    this.showBaixaModal = true;
  }

  /** Fechar modal de baixa */
  closeBaixaModal(): void {
    this.showBaixaModal = false;
    this.selectedVendaForBaixa = null;
  }

  /** Callback quando baixa é lançada */
  onBaixaLancada(vendaAtualizada: Venda): void {
    // Limpar cache de TODAS as baixas
    this.baixasCache.clear();
    
    // Recarregar a lista completa para refletir mudanças no status da venda
    this.loading = true;
    const filters: FindVendasDto = { page: this.currentPage, limit: this.pageSize };

    if (this.protocoloFilter.trim()) {
      filters.protocolo = this.protocoloFilter.trim();
    }
    if (this.clienteFilter.trim()) {
      filters.cliente = this.clienteFilter.trim();
    }
    if (this.vendedorFilter.trim()) {
      filters.vendedor = this.vendedorFilter.trim();
    }
    if (this.origemFilter) {
      filters.origem = this.origemFilter as VendaOrigem;
    }
    if (this.statusFilter) {
      filters.status = this.statusFilter as VendaStatus;
    }
    if (this.dataInicialFilter) {
      filters.dataInicial = this.dataInicialFilter;
    }
    if (this.dataFinalFilter) {
      filters.dataFinal = this.dataFinalFilter;
    }
    if (this.dataInicialFechamentoFilter) {
      filters.dataInicialFechamento = this.dataInicialFechamentoFilter;
    }
    if (this.dataFinalFechamentoFilter) {
      filters.dataFinalFechamento = this.dataFinalFechamentoFilter;
    }
    if (this.unidadeFilter) {
      filters.unidade = this.unidadeFilter as Unidade;
    }
    if (this.ativoFilter.trim()) {
      filters.ativo = this.ativoFilter.trim();
    }

    this.vendaService.getVendas(filters).subscribe({
      next: (response: VendaPaginatedResponse) => {
        this.items = response.data;
        this.totalItems = response.meta.total;
        this.totalPages = response.meta.totalPages;
        this.loading = false;

        // Recarregar as baixas de todas as vendas visíveis
        this.items.forEach(venda => {
          this.loadBaixasForVenda(venda.id);
        });
        this.applySorting();
        this.applySorting();
      },
      error: (_: any) => {
        this.loading = false;
        this.errorModalService.show('Erro ao carregar vendas', 'Erro');
      }
    });
  }

  /** Callback quando o modal de baixa é fechado */
  onBaixaModalClosed(): void {
    // Limpar cache de TODAS as baixas
    this.baixasCache.clear();
    
    // Recarregar a lista e as baixas de todas as vendas
    this.loading = true;
    const filters: FindVendasDto = { page: this.currentPage, limit: this.pageSize };

    if (this.protocoloFilter.trim()) {
      filters.protocolo = this.protocoloFilter.trim();
    }
    if (this.clienteFilter.trim()) {
      filters.cliente = this.clienteFilter.trim();
    }
    if (this.vendedorFilter.trim()) {
      filters.vendedor = this.vendedorFilter.trim();
    }
    if (this.origemFilter) {
      filters.origem = this.origemFilter as VendaOrigem;
    }
    if (this.statusFilter) {
      filters.status = this.statusFilter as VendaStatus;
    }
    if (this.dataInicialFilter) {
      filters.dataInicial = this.dataInicialFilter;
    }
    if (this.dataFinalFilter) {
      filters.dataFinal = this.dataFinalFilter;
    }
    if (this.dataInicialFechamentoFilter) {
      filters.dataInicialFechamento = this.dataInicialFechamentoFilter;
    }
    if (this.dataFinalFechamentoFilter) {
      filters.dataFinalFechamento = this.dataFinalFechamentoFilter;
    }
    if (this.unidadeFilter) {
      filters.unidade = this.unidadeFilter as Unidade;
    }
    if (this.ativoFilter.trim()) {
      filters.ativo = this.ativoFilter.trim();
    }

    this.vendaService.getVendas(filters).subscribe({
      next: (response: VendaPaginatedResponse) => {
        this.items = response.data;
        this.totalItems = response.meta.total;
        this.totalPages = response.meta.totalPages;
        this.loading = false;

        // Recarregar as baixas de todas as vendas visíveis
        this.items.forEach(venda => {
          this.loadBaixasForVenda(venda.id);
        });
      },
      error: (_: any) => {
        this.loading = false;
        this.errorModalService.show('Erro ao carregar vendas', 'Erro');
      }
    });
  }

  // Utilitários
  formatDate(date: string): string {
    // Usar apenas a parte da data sem conversão de timezone
    if (!date) return '';
    const datePart = date.split('T')[0]; // Pega apenas YYYY-MM-DD
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  getAuditFieldLabels(): Record<string, string> {
    const labels: Record<string, string> = {
      protocolo: 'Protocolo',
      dataVenda: 'Data Venda',
      cliente: 'Cliente',
      origem: 'Comprado em',
      vendedor: 'Vendedor',
      valorCliente: 'Valor Cliente',
      status: 'Status',
      observacao: 'Observação'
    };

    if (this.canViewValorCompra()) {
      labels['valorCompra'] = 'Valor Compra';
    }

    return labels;
  }

  private getTodayDateString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getOrigemLabel(origem: VendaOrigem): string {
    const labels = {
      [VendaOrigem.GOIANIA]: 'Goiânia',
      [VendaOrigem.UBERABA]: 'Uberaba',
      [VendaOrigem.NEROPOLIS]: 'Nerópolis',
      [VendaOrigem.OUTRO]: 'Outro'
    };
    return labels[origem] || origem;
  }

  getStatusLabel(status: VendaStatus): string {
    const labels = {
      [VendaStatus.REGISTRADO]: 'Registrado',
      [VendaStatus.CANCELADO]: 'Cancelado',
      [VendaStatus.PAGO]: 'Pago',
      [VendaStatus.PAGO_PARCIAL]: 'Pago Parcial',
      [VendaStatus.FECHADO]: 'Fechado'
    };
    return labels[status] || status;
  }

  getStatusClass(status: VendaStatus): string {
    const classes = {
      [VendaStatus.REGISTRADO]: 'status-registrado',
      [VendaStatus.CANCELADO]: 'status-cancelado',
      [VendaStatus.PAGO]: 'status-pago',
      [VendaStatus.PAGO_PARCIAL]: 'status-pago-parcial',
      [VendaStatus.FECHADO]: 'status-fechado'
    };
    return classes[status] || '';
  }

  // Métodos para seleção de vendas
  toggleSelectVenda(vendaId: string): void {
    if (this.selectedVendas.has(vendaId)) {
      this.selectedVendas.delete(vendaId);
    } else {
      this.selectedVendas.add(vendaId);
      // Carregar baixas para esta venda
      this.loadBaixasForVenda(vendaId);
    }
  }

  isVendaSelected(vendaId: string): boolean {
    return this.selectedVendas.has(vendaId);
  }

  toggleSelectAll(): void {
    if (this.selectedVendas.size === this.items.length && this.items.length > 0) {
      // Desmarcar todas
      this.selectedVendas.clear();
    } else {
      // Marcar todas
      this.items.forEach(venda => {
        this.selectedVendas.add(venda.id);
        this.loadBaixasForVenda(venda.id);
      });
    }
  }

  isAllSelected(): boolean {
    return this.items.length > 0 && this.selectedVendas.size === this.items.length;
  }

  isIndeterminate(): boolean {
    return this.selectedVendas.size > 0 && this.selectedVendas.size < this.items.length;
  }

  fecharVendasSelecionadas(): void {
    if (!this.canFecharVendas()) {
      return;
    }

    if (this.selectedVendas.size === 0) {
      this.errorModalService.show('Selecione pelo menos uma venda para fechar.', 'Atenção');
      return;
    }

    const erros = this.validarVendasParaFechamento();
    if (erros.length > 0) {
      this.errorModalService.show(erros.join('\n'), 'Não é possível fechar as vendas selecionadas');
      return;
    }

    const quantidade = this.selectedVendas.size;
    const confirmar = confirm(`Confirmar fechamento de ${quantidade} venda(s) selecionada(s)?`);
    if (!confirmar) {
      return;
    }

    const vendaIds = this.getSelectedVendaModels().map(venda => venda.id);
    this.fechamentoLoading = true;

    this.vendaService.fecharVendasEmMassa(vendaIds).subscribe({
      next: (resultado) => {
        this.fechamentoLoading = false;
        this.cancelamentoLoading = false;
        this.selectedVendas.clear();
        this.baixasCache.clear();
        this.loadItems();

        if (resultado.falhas?.length) {
          const detalhes = resultado.falhas
            .map(falha => falha.motivo || `Venda ${falha.id} não pôde ser fechada.`)
            .join('\n');
          this.errorModalService.show(`Algumas vendas não foram fechadas:\n${detalhes}`, 'Aviso');
        } else {
          this.errorModalService.show('Vendas fechadas com sucesso.', 'Sucesso');
        }
      },
      error: (error) => {
        this.fechamentoLoading = false;
        this.cancelamentoLoading = false;
        const message = error.error?.message || 'Erro ao fechar vendas';
        this.errorModalService.show(message, 'Erro');
      }
    });
  }

  cancelarFechamentosSelecionados(): void {
    if (!this.canCancelarFechamento()) {
      return;
    }

    if (this.selectedVendas.size === 0) {
      this.errorModalService.show('Selecione pelo menos uma venda para cancelar o fechamento.', 'Atenção');
      return;
    }

    const erros = this.validarVendasParaCancelamento();
    if (erros.length > 0) {
      this.errorModalService.show(erros.join('\n'), 'Não é possível cancelar o fechamento das vendas selecionadas');
      return;
    }

    const quantidade = this.selectedVendas.size;
    const confirmar = confirm(`Confirmar cancelamento de fechamento de ${quantidade} venda(s) selecionada(s)?`);
    if (!confirmar) {
      return;
    }

    const vendaIds = this.getSelectedVendaModels().map(venda => venda.id);
    this.cancelamentoLoading = true;

    this.vendaService.cancelarFechamentosEmMassa(vendaIds).subscribe({
      next: (resultado) => {
        this.cancelamentoLoading = false;
        this.selectedVendas.clear();
        this.baixasCache.clear();
        this.loadItems();

        if (resultado.falhas?.length) {
          const detalhes = resultado.falhas
            .map(falha => falha.motivo || `Venda ${falha.id} não pôde ter o fechamento cancelado.`)
            .join('\n');
          this.errorModalService.show(`Algumas vendas não tiveram o fechamento cancelado:\n${detalhes}`, 'Aviso');
        } else {
          this.errorModalService.show('Fechamentos cancelados com sucesso.', 'Sucesso');
        }
      },
      error: (error) => {
        this.cancelamentoLoading = false;
        const message = error.error?.message || 'Erro ao cancelar fechamento das vendas';
        this.errorModalService.show(message, 'Erro');
      }
    });
  }

  // Métodos para cálculo de totais
  getTotalValorCompra(): number {
    let total = 0;
    this.selectedVendas.forEach(vendaId => {
      const venda = this.items.find(v => v.id === vendaId);
      if (venda) {
        total += venda.valorCompra || 0;
      }
    });
    return total;
  }

  getTotalValorCliente(): number {
    let total = 0;
    this.selectedVendas.forEach(vendaId => {
      const venda = this.items.find(v => v.id === vendaId);
      if (venda) {
        total += venda.valorCliente || 0;
      }
    });
    return total;
  }

  getTotalValorBaixas(): number {
    let total = 0;
    this.selectedVendas.forEach(vendaId => {
      const baixas = this.baixasCache.get(vendaId) || [];
      baixas.forEach(baixa => {
        total += baixa.valorBaixa || 0;
      });
    });
    return total;
  }

  // Obter valor baixado para uma venda específica
  getValorBaixadoForVenda(vendaId: string): number {
    const baixas = this.baixasCache.get(vendaId);
    
    // Se não está em cache, carregar agora
    if (!baixas) {
      this.loadBaixasForVenda(vendaId);
      return 0;
    }

    let total = 0;
    baixas.forEach(baixa => {
      total += baixa.valorBaixa || 0;
    });
    return total;
  }

  // Carregar baixas para uma venda se ainda não estiver em cache
  private loadBaixasForVenda(vendaId: string): void {
    if (!this.baixasCache.has(vendaId)) {
      this.baixasService.getBaixas({ page: 1, limit: 200, idvenda: vendaId }).subscribe({
        next: (response) => {
          this.baixasCache.set(vendaId, response.data);
          // Forçar detecção de mudanças após carregar as baixas
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Erro ao carregar baixas para venda', vendaId, ':', error);
          this.baixasCache.set(vendaId, []);
          this.cdr.markForCheck();
        }
      });
    }
  }

  private getSelectedVendaModels(): Venda[] {
    return this.items.filter(venda => this.selectedVendas.has(venda.id));
  }

  private getDefaultMassBaixaForm(): { tipoDaBaixa: TipoDaBaixa; dataBaixa: string; observacao: string } {
    return {
      tipoDaBaixa: TipoDaBaixa.CARTAO_PIX,
      dataBaixa: this.getTodayDateString(),
      observacao: ''
    };
  }

  private validarVendasParaFechamento(): string[] {
    const erros: string[] = [];
    const selecionadas = this.getSelectedVendaModels();

    if (selecionadas.length === 0) {
      erros.push('Selecione ao menos uma venda para fechar.');
      return erros;
    }

    selecionadas.forEach(venda => {
      if (venda.status !== VendaStatus.PAGO) {
        erros.push(`Venda ${venda.protocolo} precisa estar com status PAGO.`);
        return;
      }

      const baixas = this.baixasCache.get(venda.id);
      if (!baixas) {
        erros.push(`Aguardando carregamento das baixas da venda ${venda.protocolo}.`);
        return;
      }

      const totalBaixas = baixas.reduce((total, baixa) => total + (baixa.valorBaixa || 0), 0);
      const valorCliente = venda.valorCliente || 0;

      if (Number(totalBaixas.toFixed(2)) !== Number(valorCliente.toFixed(2))) {
        erros.push(
          `Venda ${venda.protocolo} possui diferença entre valor do cliente (${this.formatCurrency(valorCliente)}) e total de baixas (${this.formatCurrency(totalBaixas)}).`
        );
      }
    });

    return erros;
  }

  private validarVendasParaCancelamento(): string[] {
    const erros: string[] = [];
    const selecionadas = this.getSelectedVendaModels();

    if (selecionadas.length === 0) {
      erros.push('Selecione ao menos uma venda para cancelar o fechamento.');
      return erros;
    }

    selecionadas.forEach(venda => {
      if (venda.status !== VendaStatus.FECHADO) {
        erros.push(`Venda ${venda.protocolo} precisa estar com status FECHADO.`);
      }
    });

    return erros;
  }

  private getReportTimestamp(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(
      now.getHours()
    )}${pad(now.getMinutes())}`;
  }
}
