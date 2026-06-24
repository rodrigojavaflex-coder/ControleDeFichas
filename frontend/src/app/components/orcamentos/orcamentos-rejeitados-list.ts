import {
  Component,
  OnInit,
  inject,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrcamentosService } from '../../services/orcamentos.service';
import { AuthService } from '../../services/auth.service';
import { PageContextService } from '../../services/page-context.service';
import { ErrorModalService } from '../../services/error-modal.service';
import {
  Orcamento,
  OrcamentoMotivoRejeicao,
} from '../../models/orcamento.model';
import { Permission, Unidade } from '../../models/usuario.model';
import {
  DateRangeFilterComponent,
  DateRangeValue,
} from '../date-range-filter/date-range-filter';

type SortDirection = 'asc' | 'desc';
type SortableField =
  | 'dataOrcamento'
  | 'nrOrcamento'
  | 'nomeCliente'
  | 'nomeVendedor'
  | 'unidade'
  | 'precoCobrado';

@Component({
  selector: 'app-orcamentos-rejeitados-list',
  standalone: true,
  imports: [CommonModule, FormsModule, DateRangeFilterComponent],
  templateUrl: './orcamentos-rejeitados-list.html',
  styleUrls: ['../vendas-list/vendas-list.css', './orcamentos-rejeitados-list.css'],
  encapsulation: ViewEncapsulation.None,
})
export class OrcamentosRejeitadosListComponent implements OnInit {
  private orcamentosService = inject(OrcamentosService);
  private authService = inject(AuthService);
  private pageContextService = inject(PageContextService);
  private errorModalService = inject(ErrorModalService);

  Permission = Permission;

  items: Orcamento[] = [];
  motivos: OrcamentoMotivoRejeicao[] = [];
  loading = false;
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
  dataInicialFilter = '';
  dataFinalFilter = '';
  unidades = Object.values(Unidade);
  unidadeDisabled = false;

  filtersPanelOpen = false;
  appliedFilters: { key: string; label: string; value: string }[] = [];

  selectedIds = new Set<string>();
  sortField: SortableField = 'dataOrcamento';
  sortDirection: SortDirection = 'desc';

  showMotivoModal = false;
  modalMotivoId = '';
  modalObservacao = '';
  modalSubmitting = false;

  ngOnInit(): void {
    if (!this.canRead()) {
      this.error = 'Você não possui permissão para visualizar orçamentos rejeitados.';
      return;
    }
    this.initializeUnidadeFilter();
    this.initializeDateFilters();
    this.buildAppliedFilters();
    this.pageContextService.setContext({
      title: 'Orçamentos rejeitados',
      description:
        'Classifique orçamentos rejeitados com motivo e observação. Linhas sem motivo aparecem destacadas.',
    });
    this.loadMotivos();
    this.loadItems();
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

  canRead(): boolean {
    return this.authService.hasPermission(Permission.ORCAMENTO_REJEITADO_READ);
  }

  canUpdate(): boolean {
    return this.authService.hasPermission(Permission.ORCAMENTO_REJEITADO_UPDATE);
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
    if (!this.canRead()) return;
    this.loading = true;
    this.error = '';

    const filters: Record<string, string | number | boolean> = {
      page: this.currentPage,
      limit: this.pageSize,
      sortBy: this.sortField,
      sortOrder: this.sortDirection,
    };

    if (this.unidadeFilter) filters['unidade'] = this.unidadeFilter;
    if (this.nrOrcamentoFilter.trim()) filters['nrOrcamento'] = this.nrOrcamentoFilter.trim();
    if (this.nomeClienteFilter.trim()) filters['nomeCliente'] = this.nomeClienteFilter.trim();
    if (this.nomeVendedorFilter.trim()) filters['nomeVendedor'] = this.nomeVendedorFilter.trim();
    if (this.motivoRejeicaoFilter === 'sem') {
      filters['comMotivo'] = false;
    } else if (this.motivoRejeicaoFilter) {
      filters['motivoRejeicaoId'] = this.motivoRejeicaoFilter;
    }
    if (this.dataInicialFilter) filters['dataInicial'] = this.dataInicialFilter;
    if (this.dataFinalFilter) filters['dataFinal'] = this.dataFinalFilter;

    this.orcamentosService.listarRejeitados(filters).subscribe({
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
        this.error = e?.error?.message ?? 'Erro ao carregar orçamentos rejeitados.';
      },
    });
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
    this.dataInicialFilter = '';
    this.dataFinalFilter = '';
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
      comMotivo: 'fa-tag',
      motivoRejeicao: 'fa-tag',
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
    this.filtersPanelOpen = !this.filtersPanelOpen;
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

  onRowClick(event: MouseEvent, id: string): void {
    const target = event.target as HTMLElement;
    if (target.closest('input[type="checkbox"]')) return;
    this.toggleSelection(id);
  }

  toggleSelection(id: string): void {
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
    if (this.selectedIds.size === this.items.length && this.items.length > 0) {
      this.selectedIds.clear();
    } else {
      this.items.forEach((o) => this.selectedIds.add(o.id));
    }
  }

  isAllSelected(): boolean {
    return this.items.length > 0 && this.selectedIds.size === this.items.length;
  }

  isIndeterminate(): boolean {
    return this.selectedIds.size > 0 && this.selectedIds.size < this.items.length;
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

  confirmMotivoModal(): void {
    if (!this.modalMotivoId) {
      this.errorModalService.show('Selecione um motivo de rejeição.', 'Validação');
      return;
    }
    this.modalSubmitting = true;
    this.orcamentosService
      .atualizarRejeitadosEmMassa({
        ids: Array.from(this.selectedIds),
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
    classes.push(item.motivoRejeicaoId ? 'row-com-motivo' : 'row-sem-motivo');
    return classes.join(' ');
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadItems();
  }
}
