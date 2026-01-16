import { Component, OnDestroy, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import ExcelJS from 'exceljs';
import { Subject, takeUntil } from 'rxjs';
import { VendaService } from '../../services/vendas.service';
import { ErrorModalService } from '../../services/error-modal.service';
import { AuthService } from '../../services/auth.service';
import {
  Venda,
  VendaOrigem,
  FindVendasDto,
} from '../../models/venda.model';
import { Permission, Unidade, Usuario } from '../../models/usuario.model';
import { PageContextService } from '../../services/page-context.service';
import { DateRangeFilterComponent, DateRangeValue } from '../date-range-filter/date-range-filter';
import { MultiSelectDropdownComponent, MultiSelectOption } from '../multi-select-dropdown/multi-select-dropdown';

type SortDirection = 'asc' | 'desc';
type SortableField =
  | 'protocolo'
  | 'dataVenda'
  | 'cliente'
  | 'origem'
  | 'valorCompra'
  | 'valorPago'
  | 'vendedor'
  | 'prescritor'
  | 'unidade'
  | 'observacao'
  | 'dataEnvio';

interface AcompanhamentoFilterSnapshot {
  protocolo: string;
  cliente: string;
  vendedor: string;
  prescritor: string;
  ativo: string;
  origem: string | VendaOrigem | VendaOrigem[];
  unidade: string | Unidade | Unidade[];
  dataInicial: string;
  dataFinal: string;
  dataInicialEnvio: string;
  dataFinalEnvio: string;
}

@Component({
  selector: 'app-acompanhar-vendas',
  standalone: true,
  imports: [CommonModule, FormsModule, DateRangeFilterComponent, MultiSelectDropdownComponent],
  templateUrl: './acompanhar-vendas.html',
  styleUrls: ['../vendas-list/vendas-list.css', './acompanhar-vendas.css'],
  encapsulation: ViewEncapsulation.None,
})
export class AcompanharVendasComponent implements OnInit, OnDestroy {
  private vendaService = inject(VendaService);
  private errorModalService = inject(ErrorModalService);
  private authService = inject(AuthService);
  private pageContextService = inject(PageContextService);
  private destroy$ = new Subject<void>();

  currentUser: Usuario | null = null;

  items: Venda[] = [];
  loading = false;
  error = '';

  currentPage = 1;
  pageSize = 150;
  totalItems = 0;
  totalPages = 0;

  protocoloFilter = '';
  clienteFilter = '';
  vendedorFilter = '';
  prescritorFilter = '';
  ativoFilter = '';
  origemFilter: VendaOrigem[] = [];
  unidadeFilter: Unidade[] = [];
  dataInicialFilter = '';
  dataFinalFilter = '';
  dataInicialEnvioFilter = '';
  dataFinalEnvioFilter = '';

  origemDisabled = false;
  unidadeDisabled = false;
  filtersPanelOpen = false;
  sortField: SortableField | null = null;
  sortDirection: SortDirection = 'asc';
  podeVisualizarValorCompra = false;

  private appliedFiltersSnapshot: AcompanhamentoFilterSnapshot =
    this.createFilterSnapshot();

  readonly unidades = Object.values(Unidade);
  readonly origens = Object.values(VendaOrigem);

  selectedVendas = new Set<string>();
  showRegistrarEnvioModal = false;
  registrarEnvioDate = '';
  registrarEnvioLoading = false;
  showHelpModal = false;

  ngOnInit(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.podeVisualizarValorCompra = this.authService.hasPermission(Permission.VENDA_VIEW_VALOR_COMPRA);
    this.setDefaultVendaDateRange();
    this.configureOrigemFilter();
    this.authService.currentUser$.pipe(takeUntil(this.destroy$)).subscribe(user => {
      const previousOrigem = JSON.stringify(this.origemFilter);
      this.currentUser = user;
      this.podeVisualizarValorCompra = this.authService.hasPermission(Permission.VENDA_VIEW_VALOR_COMPRA);
      this.configureOrigemFilter();
      // Comparar arrays para verificar mudança
      const currentOrigem = JSON.stringify(this.origemFilter);
      if (currentOrigem !== previousOrigem && this.origemFilter.length > 0) {
        this.applyFilters();
      }
    });
    this.pageContextService.setContext({
      title: 'Acompanhar Vendas',
      description: 'Acompanhe o que outras unidades compraram da sua unidade em tempo real.',
    });
    this.loadItems();
  }

  ngOnDestroy(): void {
    this.pageContextService.resetContext();
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleFiltersVisibility(): void {
    this.filtersPanelOpen = !this.filtersPanelOpen;
  }

  onFiltersToggleKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.toggleFiltersVisibility();
    }
  }

  applyFilters(): void {
    this.currentPage = 1;
    this.updateAppliedFiltersSnapshot();
    this.filtersPanelOpen = false;
    this.loadItems();
  }

  clearFilters(): void {
    this.protocoloFilter = '';
    this.clienteFilter = '';
    this.vendedorFilter = '';
    this.prescritorFilter = '';
    this.ativoFilter = '';
    if (!this.unidadeDisabled) {
      this.unidadeFilter = [];
    }
    if (!this.origemDisabled) {
      this.origemFilter = [];
    }
    this.dataInicialFilter = '';
    this.dataFinalFilter = '';
    this.dataInicialEnvioFilter = '';
    this.dataFinalEnvioFilter = '';
    this.configureOrigemFilter();
    this.updateAppliedFiltersSnapshot();
    this.applyFilters();
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    this.currentPage = page;
    this.loadItems();
  }

  toggleSelectAll(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.checked) {
      this.items.forEach(venda => this.selectedVendas.add(venda.id));
    } else {
      this.selectedVendas.clear();
    }
  }

  toggleSelectVenda(vendaId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.checked) {
      this.selectedVendas.add(vendaId);
    } else {
      this.selectedVendas.delete(vendaId);
    }
  }

  openRegistrarEnvioModal(): void {
    if (this.selectedVendas.size === 0) {
      this.errorModalService.show('Selecione ao menos uma venda para registrar envio.', 'Aviso');
      return;
    }
    this.registrarEnvioDate = this.getTodayDateString();
    this.showRegistrarEnvioModal = true;
  }

  openHelpModal(): void {
    this.showHelpModal = true;
  }

  closeHelpModal(): void {
    this.showHelpModal = false;
  }

  onVendaRangeChange(range: DateRangeValue): void {
    this.dataInicialFilter = range.start || '';
    this.dataFinalFilter = range.end || '';
    this.applyFilters();
  }

  onEnvioRangeChange(range: DateRangeValue): void {
    this.dataInicialEnvioFilter = range.start || '';
    this.dataFinalEnvioFilter = range.end || '';
    this.applyFilters();
  }

  // Métodos para o modal - apenas atualizam valores sem disparar pesquisa
  onVendaRangeChangeModal(range: DateRangeValue): void {
    this.dataInicialFilter = range.start || '';
    this.dataFinalFilter = range.end || '';
    // Não chama applyFilters() - apenas atualiza os valores
  }

  onEnvioRangeChangeModal(range: DateRangeValue): void {
    this.dataInicialEnvioFilter = range.start || '';
    this.dataFinalEnvioFilter = range.end || '';
    // Não chama applyFilters() - apenas atualiza os valores
  }

  onContainerClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target) {
      return;
    }
    
    // Verificar elementos que devem bloquear a abertura do modal
    const btnToggle = target.closest('.btn-toggle-filtros');
    const chipRemove = target.closest('.chip-remove');
    const btnClearAll = target.closest('.btn-clear-all');
    const resultsCount = target.closest('.results-count');
    
    // Não abrir se clicar em:
    // - Botão de toggle
    // - Botões dentro dos filtros (X, limpar todos)
    // - Contador de resultados
    if (btnToggle || chipRemove || btnClearAll || resultsCount) {
      return;
    }
    
    // Verificar se o clique foi em um chip (mas não no X)
    const filterChip = target.closest('.filter-chip');
    if (filterChip && !chipRemove) {
      this.toggleFiltersVisibility();
      return;
    }
    
    // Verificar se o clique foi no container principal ou em áreas vazias
    const filtersPanelTop = target.closest('.filters-panel-top');
    if (filtersPanelTop) {
      this.toggleFiltersVisibility();
      return;
    }
  }

  isMultipleFilter(key: string): boolean {
    return ['origem', 'unidade'].includes(key);
  }
  
  getFilterIcon(key: string): string {
    const icons: { [key: string]: string } = {
      protocolo: 'fa-hashtag',
      cliente: 'fa-user',
      vendedor: 'fa-user-tie',
      prescritor: 'fa-user-md',
      ativo: 'fa-pills',
      origem: 'fa-map-marker-alt',
      unidade: 'fa-building',
      dataVenda: 'fa-calendar-alt',
      dataEnvio: 'fa-truck'
    };
    return icons[key] || 'fa-filter';
  }
  
  formatFilterValue(filter: { key: string; label: string; value: string }): string {
    // Truncar valores muito longos
    const maxLength = 30;
    if (filter.value.length > maxLength) {
      return filter.value.substring(0, maxLength) + '...';
    }
    return filter.value;
  }

  getOrigemOptions(): MultiSelectOption[] {
    return this.origens.map(origem => ({
      value: origem,
      label: this.getOrigemLabel(origem)
    }));
  }

  getUnidadeOptions(): MultiSelectOption[] {
    return this.unidades.map(unidade => ({
      value: unidade,
      label: unidade
    }));
  }

  onSelectChange(): void {
    this.applyFilters();
  }

  closeRegistrarEnvioModal(): void {
    if (this.registrarEnvioLoading) {
      return;
    }
    this.showRegistrarEnvioModal = false;
  }

  confirmarRegistrarEnvio(): void {
    if (!this.registrarEnvioDate) {
      this.errorModalService.show('Informe a data de envio.', 'Validação');
      return;
    }

    const vendaIds = Array.from(this.selectedVendas);
    this.registrarEnvioLoading = true;
    this.vendaService.registrarEnvio(vendaIds, this.registrarEnvioDate).subscribe({
      next: () => {
        this.registrarEnvioLoading = false;
        this.showRegistrarEnvioModal = false;
        this.selectedVendas.clear();
        this.loadItems();
      },
      error: (error) => {
        this.registrarEnvioLoading = false;
        const message = error?.error?.message || 'Erro ao registrar envio.';
        this.errorModalService.show(message, 'Erro');
      }
    });
  }

  onRowClick(venda: Venda, event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('input[type="checkbox"]')) {
      return;
    }

    if (this.isVendaSelected(venda.id)) {
      this.selectedVendas.delete(venda.id);
    } else {
      this.selectedVendas.add(venda.id);
    }
  }

  isVendaSelected(vendaId: string): boolean {
    return this.selectedVendas.has(vendaId);
  }

  isAllSelected(): boolean {
    return this.items.length > 0 && this.selectedVendas.size === this.items.length;
  }

  isIndeterminate(): boolean {
    return this.selectedVendas.size > 0 && this.selectedVendas.size < this.items.length;
  }

  hasSelection(): boolean {
    return this.selectedVendas.size > 0;
  }

  imprimirSelecionadas(): void {
    const vendas = this.getSelectedVendaModels();
    if (vendas.length === 0) {
      this.errorModalService.show('Selecione ao menos uma venda para imprimir.', 'Aviso');
      return;
    }

    const popup = window.open('', '_blank', 'width=1024,height=768');
    if (!popup) {
      this.errorModalService.show('Não foi possível abrir a janela de impressão.', 'Erro');
      return;
    }

    const podeVerValorCompra = this.canViewValorCompra();
    const linhas = vendas
      .map(venda => {
        const valorCompraCol = podeVerValorCompra ? `<td>${this.formatCurrency(venda.valorCompra || 0)}</td>` : '';
        const valorPagoCol = podeVerValorCompra ? `<td>${this.formatCurrency(venda.valorPago || 0)}</td>` : '';
        return `
          <tr>
            <td>${venda.protocolo}</td>
            <td>${this.formatDate(venda.dataVenda)}</td>
            <td>${this.formatDate(venda.dataEnvio) || '-'}</td>
            ${valorCompraCol}
            ${valorPagoCol}
            <td>${this.getClienteNome(venda)}</td>
            <td>${this.getOrigemLabel(venda.origem)}</td>
            <td>${this.getVendedorNome(venda)}</td>
            <td>${this.getPrescritorNome(venda) || '-'}</td>
            <td>${venda.observacao || '-'}</td>
          </tr>
        `;
      })
      .join('');

    popup.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Relatório - Acompanhar Vendas</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; margin: 16px; color: #1a202c; }
            h1 { font-size: 20px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
            th { background: #f8fafc; text-transform: uppercase; font-size: 12px; }
            .meta { font-size: 12px; color: #475569; }
          </style>
        </head>
        <body>
          <h1>Acompanhar Vendas</h1>
          <div class="meta">Gerado em ${this.getReportTimestamp()}</div>
          <table>
            <thead>
              <tr>
                <th>Protocolo</th>
                <th>Data Venda</th>
                <th>Data Envio</th>
                ${podeVerValorCompra ? '<th>Valor Compra</th>' : ''}
                ${podeVerValorCompra ? '<th>Valor Pago</th>' : ''}
                <th>Cliente</th>
                <th>Comprado em</th>
                <th>Vendedor</th>
                <th>Prescritor</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              ${linhas}
            </tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
  }

  async exportarSelecionadasParaExcel(): Promise<void> {
    const vendas = this.getSelectedVendaModels();
    if (vendas.length === 0) {
      this.errorModalService.show('Selecione ao menos uma venda para exportar.', 'Aviso');
      return;
    }

    const planilha = vendas.map(venda => {
      const linha: Record<string, string | number> = {
      Protocolo: venda.protocolo,
      'Data Venda': this.formatDate(venda.dataVenda),
      'Data Envio': this.formatDate(venda.dataEnvio) || '-',
      Cliente: this.getClienteNome(venda),
      'Comprado em': this.getOrigemLabel(venda.origem),
      Vendedor: this.getVendedorNome(venda),
      Prescritor: this.getPrescritorNome(venda) || '-',
      Observação: venda.observacao || '',
      };

      if (this.canViewValorCompra()) {
        linha['Valor Compra'] = venda.valorCompra || 0;
        linha['Valor Pago'] = venda.valorPago || 0;
      }

      return linha;
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Acompanhar Vendas');
    
    if (planilha.length > 0) {
      const headers = Object.keys(planilha[0]);
      worksheet.columns = headers.map(header => ({ header, key: header }));
      planilha.forEach(row => worksheet.addRow(row));
    }

    try {
      const fileName = `Acompanhar_Vendas_${this.getReportTimestamp().replace(/[:\\s]/g, '-')}.xlsx`;
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar para Excel:', error);
      this.errorModalService.show('Erro ao exportar planilha. Tente novamente.', 'Erro');
    }
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

  private loadItems(): void {
    this.loading = true;
    this.error = '';

    const filters: FindVendasDto = {
      page: this.currentPage,
      limit: this.pageSize,
    };

    if (this.protocoloFilter.trim()) {
      filters.protocolo = this.protocoloFilter.trim();
    }
    if (this.clienteFilter.trim()) {
      filters.cliente = this.clienteFilter.trim();
    }
    if (this.vendedorFilter.trim()) {
      filters.vendedor = this.vendedorFilter.trim();
    }
    if (this.prescritorFilter.trim()) {
      filters.prescritor = this.prescritorFilter.trim();
    }
    if (this.ativoFilter.trim()) {
      filters.ativo = this.ativoFilter.trim();
    }
    if (this.unidadeFilter && this.unidadeFilter.length > 0) {
      filters.unidade = this.unidadeFilter.length === 1 ? this.unidadeFilter[0] : this.unidadeFilter;
    }
    if (this.origemFilter && this.origemFilter.length > 0) {
      filters.origem = this.origemFilter.length === 1 ? this.origemFilter[0] : this.origemFilter;
    }
    if (this.dataInicialFilter) {
      filters.dataInicial = this.dataInicialFilter;
    }
    if (this.dataFinalFilter) {
      filters.dataFinal = this.dataFinalFilter;
    }
    if (this.dataInicialEnvioFilter) {
      (filters as any).dataInicialEnvio = this.dataInicialEnvioFilter;
    }
    if (this.dataFinalEnvioFilter) {
      (filters as any).dataFinalEnvio = this.dataFinalEnvioFilter;
    }

    this.vendaService.getAcompanhamentoVendas(filters).subscribe({
      next: response => {
        this.items = response.data;
        this.totalItems = response.meta.total;
        this.totalPages = response.meta.totalPages;
        this.applySorting();
        this.loading = false;
        this.selectedVendas.clear();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Erro ao carregar vendas para acompanhamento.';
      }
    });
  }

  private configureOrigemFilter(): void {
    const unidadeAtual = this.currentUser?.unidade || null;
    const origem = this.mapUnidadeParaOrigem(unidadeAtual);

    // Se o usuário possui unidade definida, o filtro de origem deve ficar bloqueado,
    // mesmo que a unidade não tenha mapeamento explícito.
    // O filtro de unidade não é setado nem bloqueado automaticamente.
    if (unidadeAtual) {
      this.origemFilter = origem ? [origem] : [];
      this.origemDisabled = true;
      // Unidade não é setada nem bloqueada automaticamente
      this.unidadeDisabled = false;
    } else {
      this.origemFilter = origem ? [origem] : [];
      this.origemDisabled = false;
      this.unidadeDisabled = false;
    }
    this.updateAppliedFiltersSnapshot();
  }

  private setDefaultVendaDateRange(): void {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const toIsoDate = (date: Date) => date.toISOString().split('T')[0];

    this.dataInicialFilter = toIsoDate(firstDay);
    this.dataFinalFilter = toIsoDate(lastDay);
  }

  private createFilterSnapshot(): AcompanhamentoFilterSnapshot {
    return {
      protocolo: this.protocoloFilter || '',
      cliente: this.clienteFilter || '',
      vendedor: this.vendedorFilter || '',
      prescritor: this.prescritorFilter || '',
      ativo: this.ativoFilter || '',
      origem: this.origemFilter.length > 0 ? (this.origemFilter.length === 1 ? this.origemFilter[0] : this.origemFilter) : ('' as any),
      unidade: this.unidadeFilter.length > 0 ? (this.unidadeFilter.length === 1 ? this.unidadeFilter[0] : this.unidadeFilter) : ('' as any),
      dataInicial: this.dataInicialFilter || '',
      dataFinal: this.dataFinalFilter || '',
      dataInicialEnvio: this.dataInicialEnvioFilter || '',
      dataFinalEnvio: this.dataFinalEnvioFilter || '',
    };
  }

  private updateAppliedFiltersSnapshot(): void {
    this.appliedFiltersSnapshot = this.createFilterSnapshot();
  }

  get appliedFilters() {
    const filters: { key: string; label: string; value: string }[] = [];
    const snapshot = this.appliedFiltersSnapshot;

    if (snapshot.protocolo.trim()) {
      filters.push({ key: 'protocolo', label: 'Protocolo', value: snapshot.protocolo });
    }
    if (snapshot.cliente.trim()) {
      filters.push({ key: 'cliente', label: 'Cliente', value: snapshot.cliente });
    }
    if (snapshot.vendedor.trim()) {
      filters.push({ key: 'vendedor', label: 'Vendedor', value: snapshot.vendedor });
    }
    if (snapshot.prescritor.trim()) {
      filters.push({ key: 'prescritor', label: 'Prescritor', value: snapshot.prescritor });
    }
    if (snapshot.ativo.trim()) {
      filters.push({ key: 'ativo', label: 'Ativo', value: snapshot.ativo });
    }
    if (snapshot.origem && (Array.isArray(snapshot.origem) ? snapshot.origem.length > 0 : snapshot.origem !== '')) {
      const origens = Array.isArray(snapshot.origem) ? snapshot.origem : [snapshot.origem];
      const origemLabels = origens.map(origem => this.getOrigemLabel(origem as VendaOrigem));
      if (origemLabels.length > 0) {
        filters.push({ key: 'origem', label: 'Comprado em', value: origemLabels.join(', ') });
      }
    }
    if (snapshot.unidade && (Array.isArray(snapshot.unidade) ? snapshot.unidade.length > 0 : snapshot.unidade !== '')) {
      const unidades = Array.isArray(snapshot.unidade) ? snapshot.unidade : [snapshot.unidade];
      if (unidades.length > 0) {
        filters.push({ key: 'unidade', label: 'Unidade', value: unidades.join(', ') });
      }
    }
    if (snapshot.dataInicial || snapshot.dataFinal) {
      let value = '';
      if (snapshot.dataInicial && snapshot.dataFinal) {
        value = `${this.formatDate(snapshot.dataInicial)} a ${this.formatDate(snapshot.dataFinal)}`;
      } else if (snapshot.dataInicial) {
        value = `A partir de ${this.formatDate(snapshot.dataInicial)}`;
      } else if (snapshot.dataFinal) {
        value = `Até ${this.formatDate(snapshot.dataFinal)}`;
      }
      filters.push({ key: 'dataVenda', label: 'Data da Venda', value });
    }
    if (snapshot.dataInicialEnvio || snapshot.dataFinalEnvio) {
      let value = '';
      if (snapshot.dataInicialEnvio && snapshot.dataFinalEnvio) {
        value = `${this.formatDate(snapshot.dataInicialEnvio)} a ${this.formatDate(snapshot.dataFinalEnvio)}`;
      } else if (snapshot.dataInicialEnvio) {
        value = `A partir de ${this.formatDate(snapshot.dataInicialEnvio)}`;
      } else if (snapshot.dataFinalEnvio) {
        value = `Até ${this.formatDate(snapshot.dataFinalEnvio)}`;
      }
      filters.push({ key: 'dataEnvio', label: 'Data de Envio', value });
    }

    return filters.filter(filter => !!filter.value);
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
      case 'prescritor':
        this.prescritorFilter = '';
        break;
      case 'ativo':
        this.ativoFilter = '';
        break;
      case 'origem':
        if (!this.origemDisabled) {
          this.origemFilter = [];
        }
        break;
      case 'unidade':
        if (!this.unidadeDisabled) {
          this.unidadeFilter = [];
        }
        break;
      case 'status':
      case 'dataVenda':
        this.dataInicialFilter = '';
        this.dataFinalFilter = '';
        break;
      case 'dataEnvio':
        this.dataInicialEnvioFilter = '';
        this.dataFinalEnvioFilter = '';
        break;
      default:
        return;
    }
    this.updateAppliedFiltersSnapshot();
    this.applyFilters();
  }

  private getSelectedVendaModels(): Venda[] {
    return this.items.filter(venda => this.selectedVendas.has(venda.id));
  }

  private getTodayDateString(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDate(date: string | Date | null | undefined): string {
    if (!date) {
      return '';
    }
    if (typeof date === 'string') {
      return date.split('T')[0]?.split('-').reverse().join('/') || date;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${day}/${month}/${year}`;
  }

  getOrigemLabel(origem?: VendaOrigem | null): string {
    if (!origem) {
      return '-';
    }
    const labels: Record<VendaOrigem, string> = {
      [VendaOrigem.GOIANIA]: 'Goiânia',
      [VendaOrigem.INHUMAS]: 'Inhumas',
      [VendaOrigem.UBERABA]: 'Uberaba',
      [VendaOrigem.NEROPOLIS]: 'Nerópolis',
      [VendaOrigem.RIBEIRAO_PRETO]: 'Ribeirão Preto',
      [VendaOrigem.OUTRO]: 'Outro',
    };
    return labels[origem] || origem;
  }

  getClienteNome(venda: Venda): string {
    if (venda.cliente && typeof venda.cliente === 'object') {
      return venda.cliente.nome;
    }
    // Compatibilidade temporária com campo texto (será removido após migration)
    return (venda.cliente as any) || '-';
  }

  getVendedorNome(venda: Venda): string {
    if (venda.vendedor && typeof venda.vendedor === 'object') {
      return venda.vendedor.nome;
    }
    // Compatibilidade temporária com campo texto (será removido após migration)
    return (venda.vendedor as any) || '-';
  }

  getPrescritorNome(venda: Venda): string | null {
    if (venda.prescritor && typeof venda.prescritor === 'object') {
      return venda.prescritor.nome;
    }
    // Compatibilidade temporária com campo texto (será removido após migration)
    return (venda.prescritor as any) || null;
  }

  canViewValorCompra(): boolean {
    return this.podeVisualizarValorCompra;
  }

  formatCurrency(value: number | null | undefined): string {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  private mapUnidadeParaOrigem(unidade: Unidade | string | null | undefined): VendaOrigem | '' {
    if (!unidade) {
      return '';
    }

    const normalized = unidade.toString().trim().toUpperCase();

    switch (normalized) {
      case Unidade.INHUMAS:
        return VendaOrigem.INHUMAS;
      case Unidade.UBERABA:
        return VendaOrigem.UBERABA;
      case Unidade.NERÓPOLIS:
      case 'NEROPOLIS':
        return VendaOrigem.NEROPOLIS;
      case 'GOIANIA':
        return VendaOrigem.GOIANIA;
      default:
        return '';
    }
  }

  private getReportTimestamp(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
      now.getHours(),
    )}:${pad(now.getMinutes())}`;
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
        numeric: true,
      }) * direction;
    });
  }

  private getSortableValue(venda: Venda, field: SortableField): any {
    switch (field) {
      case 'protocolo':
        return venda.protocolo;
      case 'dataVenda':
        return venda.dataVenda ? new Date(venda.dataVenda).getTime() : null;
      case 'cliente':
        return this.getClienteNome(venda);
      case 'origem':
        return this.getOrigemLabel(venda.origem);
      case 'valorCompra':
        return venda.valorCompra ?? 0;
      case 'valorPago':
        return venda.valorPago ?? 0;
      case 'vendedor':
        return this.getVendedorNome(venda);
      case 'prescritor':
        return this.getPrescritorNome(venda) || '';
      case 'unidade':
        return venda.unidade || '';
      case 'observacao':
        return venda.observacao || '';
      case 'dataEnvio':
        return venda.dataEnvio ? new Date(venda.dataEnvio).getTime() : null;
      default:
        return venda.protocolo;
    }
  }
}
