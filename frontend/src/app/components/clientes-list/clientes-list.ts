import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClientesService } from '../../services/clientes.service';
import { Cliente, FindClientesDto, ClientePaginatedResponse } from '../../models/cliente.model';
import { Unidade, Permission } from '../../models/usuario.model';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { BaseListComponent } from '../base-list.component';
import { PageContextService } from '../../services/page-context.service';
import { AuthService } from '../../services/auth.service';
import { HistoricoAuditoriaComponent } from '../historico-auditoria/historico-auditoria.component';

@Component({
  selector: 'app-clientes-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent, HistoricoAuditoriaComponent],
  templateUrl: './clientes-list.html',
  styleUrls: ['./clientes-list.css']
})
export class ClientesListComponent extends BaseListComponent<Cliente> implements OnInit {
  private clientesService = inject(ClientesService);
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
  cpfFilter = '';
  unidadeFilter: Unidade | '' = '';
  unidades = Object.values(Unidade);
  unidadeDisabled = false;

  deleteModalTitle = 'Confirmação de Exclusão';

  // Modal de auditoria
  showAuditModal = false;
  selectedClienteForAudit: Cliente | null = null;

  override ngOnInit(): void {
    if (!this.canReadCliente()) {
      this.error = 'Você não possui permissão para visualizar clientes.';
      this.errorModalService.show('Você não possui permissão para visualizar clientes', 'Acesso Negado');
      return;
    }
    
    this.initializeUnidadeFilter();
    super.ngOnInit();
    this.pageContextService.setContext({
      title: 'Lista de Clientes',
      description: 'Consulte e gerencie todos os clientes cadastrados.'
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

    const filters: FindClientesDto = { page: this.currentPage, limit: this.pageSize };

    if (this.nomeFilter.trim()) {
      filters.nome = this.nomeFilter.trim();
    }

    if (this.cpfFilter.trim()) {
      filters.cpf = this.cpfFilter.trim();
    }

    if (this.unidadeFilter) {
      filters.unidade = this.unidadeFilter;
    }

    this.clientesService.findAll(filters).subscribe({
      next: (response: ClientePaginatedResponse) => {
        this.items = response.data;
        this.totalItems = response.meta.total;
        this.totalPages = response.meta.totalPages;
        this.loading = false;
      },
      error: (_: any) => {
        this.loading = false;
        this.errorModalService.show('Erro ao carregar clientes', 'Erro');
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
    this.cpfFilter = '';
    // Não limpar unidade se estiver desabilitada (usuário tem unidade fixa)
    if (!this.unidadeDisabled) {
      this.unidadeFilter = '';
    }
    this.currentPage = 1;
    this.loadItems();
  }

  createCliente(): void {
    this.router.navigate(['/clientes/new']);
  }

  editCliente(cliente: Cliente): void {
    this.router.navigate(['/clientes/edit', cliente.id]);
  }

  deleteCliente(cliente: Cliente): void {
    this.confirmDelete(cliente, `Tem certeza que deseja excluir o cliente "${cliente.nome}"?`);
  }

  protected override deleteItem(id: string) {
    return this.clientesService.remove(id);
  }

  protected override getId(item: Cliente): string {
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
  canCreateCliente(): boolean {
    return this.authService.hasPermission(Permission.CLIENTE_CREATE);
  }

  canReadCliente(): boolean {
    return this.authService.hasPermission(Permission.CLIENTE_READ);
  }

  canEditCliente(): boolean {
    return this.authService.hasPermission(Permission.CLIENTE_UPDATE);
  }

  canDeleteCliente(): boolean {
    return this.authService.hasPermission(Permission.CLIENTE_DELETE);
  }

  canAuditCliente(): boolean {
    return this.authService.hasPermission(Permission.CLIENTE_AUDIT);
  }

  abrirAuditoriaCliente(cliente: Cliente): void {
    if (!this.canAuditCliente()) {
      return;
    }
    this.selectedClienteForAudit = cliente;
    this.showAuditModal = true;
  }

  closeAuditModal(): void {
    this.showAuditModal = false;
    this.selectedClienteForAudit = null;
  }

  getAuditFieldLabels(): Record<string, string> {
    return {
      nome: 'Nome',
      cdcliente: 'Código Cliente',
      cpf: 'CPF',
      dataNascimento: 'Data de Nascimento',
      email: 'Email',
      telefone: 'Telefone',
      unidade: 'Unidade'
    };
  }
}

