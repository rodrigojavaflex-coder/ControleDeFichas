import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrescritoresService } from '../../services/prescritores.service';
import { Prescritor, FindPrescritoresDto, PrescritorPaginatedResponse } from '../../models/prescritor.model';
import { Permission } from '../../models/usuario.model';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { BaseListComponent } from '../base-list.component';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { HistoricoAuditoriaComponent } from '../historico-auditoria/historico-auditoria.component';

@Component({
  selector: 'app-prescritores-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent, HistoricoAuditoriaComponent],
  templateUrl: './prescritores-list.html',
  styleUrls: ['./prescritores-list.css']
})
export class PrescritoresListComponent extends BaseListComponent<Prescritor> implements OnInit {
  private prescritoresService = inject(PrescritoresService);
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
  numeroCRMFilter = '';

  deleteModalTitle = 'Confirmação de Exclusão';

  // Modal de auditoria
  showAuditModal = false;
  selectedPrescritorForAudit: Prescritor | null = null;

  override ngOnInit(): void {
    if (!this.canReadPrescritor()) {
      this.error = 'Você não possui permissão para visualizar prescritores.';
      this.errorModalService.show('Você não possui permissão para visualizar prescritores', 'Acesso Negado');
      return;
    }
    
    super.ngOnInit();
    this.pageContextService.setContext({
      title: 'Lista de Prescritores',
      description: 'Consulte e gerencie todos os prescritores cadastrados.'
    });
  }

  protected override loadItems(): void {
    this.loading = true;
    this.error = '';

    const filters: FindPrescritoresDto = { page: this.currentPage, limit: this.pageSize };

    if (this.nomeFilter.trim()) {
      filters.nome = this.nomeFilter.trim();
    }

    if (this.numeroCRMFilter.trim()) {
      const crmNumber = parseInt(this.numeroCRMFilter.trim());
      if (!isNaN(crmNumber)) {
        filters.numeroCRM = crmNumber;
      }
    }

    this.prescritoresService.findAll(filters).subscribe({
      next: (response: PrescritorPaginatedResponse) => {
        this.items = response.data;
        this.totalItems = response.meta.total;
        this.totalPages = response.meta.totalPages;
        this.loading = false;
      },
      error: (_: any) => {
        this.loading = false;
        this.errorModalService.show('Erro ao carregar prescritores', 'Erro');
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
    this.numeroCRMFilter = '';
    this.currentPage = 1;
    this.loadItems();
  }

  createPrescritor(): void {
    this.router.navigate(['/prescritores/new']);
  }

  editPrescritor(prescritor: Prescritor): void {
    this.router.navigate(['/prescritores/edit', prescritor.id]);
  }

  deletePrescritor(prescritor: Prescritor): void {
    this.confirmDelete(prescritor, `Tem certeza que deseja excluir o prescritor "${prescritor.nome}"?`);
  }

  protected override deleteItem(id: string) {
    return this.prescritoresService.remove(id);
  }

  protected override getId(item: Prescritor): string {
    return item.id;
  }

  formatDate(date: Date | string): string {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('pt-BR');
  }

  getCRMFormat(prescritor: Prescritor): string {
    if (prescritor.numeroCRM && prescritor.UFCRM) {
      return `CRM ${prescritor.numeroCRM}/${prescritor.UFCRM}`;
    }
    if (prescritor.numeroCRM) {
      return `CRM ${prescritor.numeroCRM}`;
    }
    return '-';
  }

  // Métodos para verificar permissões
  canCreatePrescritor(): boolean {
    return this.authService.hasPermission(Permission.PRESCRITOR_CREATE);
  }

  canReadPrescritor(): boolean {
    return this.authService.hasPermission(Permission.PRESCRITOR_READ);
  }

  canEditPrescritor(): boolean {
    return this.authService.hasPermission(Permission.PRESCRITOR_UPDATE);
  }

  canDeletePrescritor(): boolean {
    return this.authService.hasPermission(Permission.PRESCRITOR_DELETE);
  }

  canAuditPrescritor(): boolean {
    return this.authService.hasPermission(Permission.PRESCRITOR_AUDIT);
  }

  abrirAuditoriaPrescritor(prescritor: Prescritor): void {
    if (!this.canAuditPrescritor()) {
      return;
    }
    this.selectedPrescritorForAudit = prescritor;
    this.showAuditModal = true;
  }

  closeAuditModal(): void {
    this.showAuditModal = false;
    this.selectedPrescritorForAudit = null;
  }

  getAuditFieldLabels(): Record<string, string> {
    return {
      nome: 'Nome',
      numeroCRM: 'Número CRM',
      UFCRM: 'UF CRM'
    };
  }
}

