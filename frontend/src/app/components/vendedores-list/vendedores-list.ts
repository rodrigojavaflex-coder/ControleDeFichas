import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VendedoresService } from '../../services/vendedores.service';
import { Vendedor, FindVendedoresDto, VendedorPaginatedResponse } from '../../models/vendedor.model';
import { Unidade, Permission } from '../../models/usuario.model';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { BaseListComponent } from '../base-list.component';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { HistoricoAuditoriaComponent } from '../historico-auditoria/historico-auditoria.component';

@Component({
  selector: 'app-vendedores-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent, HistoricoAuditoriaComponent],
  templateUrl: './vendedores-list.html',
  styleUrls: ['./vendedores-list.css']
})
export class VendedoresListComponent extends BaseListComponent<Vendedor> implements OnInit {
  private vendedoresService = inject(VendedoresService);
  private router = inject(Router);
  private pageContextService = inject(PageContextService);
  private authService = inject(AuthService);

  Permission = Permission;

  // Paginação
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 0;

  // Filtros
  nomeFilter = '';
  unidadeFilter: Unidade | '' = '';
  unidades = Object.values(Unidade);
  unidadeDisabled = false;

  deleteModalTitle = 'Confirmação de Exclusão';

  // Modal de auditoria
  showAuditModal = false;
  selectedVendedorForAudit: Vendedor | null = null;

  override ngOnInit(): void {
    if (!this.canReadVendedor()) {
      this.error = 'Você não possui permissão para visualizar vendedores.';
      this.errorModalService.show('Você não possui permissão para visualizar vendedores', 'Acesso Negado');
      return;
    }
    
    this.initializeUnidadeFilter();
    super.ngOnInit();
    this.pageContextService.setContext({
      title: 'Lista de Vendedores',
      description: 'Consulte e gerencie todos os vendedores cadastrados.'
    });
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

  protected override loadItems(): void {
    this.loading = true;
    this.error = '';

    const filters: FindVendedoresDto = { page: this.currentPage, limit: this.pageSize };

    if (this.nomeFilter.trim()) {
      filters.nome = this.nomeFilter.trim();
    }

    if (this.unidadeFilter) {
      filters.unidade = this.unidadeFilter;
    }

    this.vendedoresService.findAll(filters).subscribe({
      next: (response: VendedorPaginatedResponse) => {
        this.items = response.data;
        this.totalItems = response.meta.total;
        this.totalPages = response.meta.totalPages;
        this.loading = false;
      },
      error: (_: any) => {
        this.loading = false;
        this.errorModalService.show('Erro ao carregar vendedores', 'Erro');
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadItems();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadItems();
  }

  clearFilters(): void {
    this.nomeFilter = '';
    // Não limpar unidade se estiver desabilitada (usuário tem unidade fixa)
    if (!this.unidadeDisabled) {
      this.unidadeFilter = '';
    }
    this.currentPage = 1;
    this.loadItems();
  }

  createVendedor(): void {
    this.router.navigate(['/vendedores/new']);
  }

  editVendedor(vendedor: Vendedor): void {
    this.router.navigate(['/vendedores/edit', vendedor.id]);
  }

  deleteVendedor(vendedor: Vendedor): void {
    this.confirmDelete(vendedor, `Tem certeza que deseja excluir o vendedor "${vendedor.nome}"?`);
  }

  protected override deleteItem(id: string) {
    return this.vendedoresService.remove(id);
  }

  protected override getId(item: Vendedor): string {
    return item.id;
  }

  formatDate(date: Date | string): string {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('pt-BR');
  }

  getUnidadeLabel(unidade: Unidade): string {
    return unidade;
  }

  // Métodos para verificar permissões
  canCreateVendedor(): boolean {
    return this.authService.hasPermission(Permission.VENDEDOR_CREATE);
  }

  canReadVendedor(): boolean {
    return this.authService.hasPermission(Permission.VENDEDOR_READ);
  }

  canEditVendedor(): boolean {
    return this.authService.hasPermission(Permission.VENDEDOR_UPDATE);
  }

  canDeleteVendedor(): boolean {
    return this.authService.hasPermission(Permission.VENDEDOR_DELETE);
  }

  canAuditVendedor(): boolean {
    return this.authService.hasPermission(Permission.VENDEDOR_AUDIT);
  }

  abrirAuditoriaVendedor(vendedor: Vendedor): void {
    if (!this.canAuditVendedor()) {
      return;
    }
    this.selectedVendedorForAudit = vendedor;
    this.showAuditModal = true;
  }

  closeAuditModal(): void {
    this.showAuditModal = false;
    this.selectedVendedorForAudit = null;
  }

  getAuditFieldLabels(): Record<string, string> {
    return {
      nome: 'Nome',
      cdVendedor: 'Código Vendedor',
      unidade: 'Unidade'
    };
  }
}

