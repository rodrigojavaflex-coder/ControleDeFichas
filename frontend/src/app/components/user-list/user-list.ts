import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth.service';
import { Usuario, PaginatedResponse, FindUsuariosDto, Permission } from '../../models/usuario.model';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { BaseListComponent } from '../base-list.component';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationModalComponent],
  templateUrl: './user-list.html',
  styleUrls: ['./user-list.css']
})
export class UserListComponent extends BaseListComponent<Usuario> {
  private userService = inject(UserService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // Paginação
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 0;

  // Filtros
  nameFilter = '';
  emailFilter = '';
  /** Título do modal de confirmação de exclusão */
  deleteModalTitle = 'Confirmação de Exclusão';

  override ngOnInit(): void {
    super.ngOnInit();
  }

  protected override loadItems(): void {
    this.loading = true;
    this.error = '';

    const filters: FindUsuariosDto = { page: this.currentPage, limit: this.pageSize };

    if (this.nameFilter.trim()) {
      filters.nome = this.nameFilter.trim();
    }

    if (this.emailFilter.trim()) {
      filters.email = this.emailFilter.trim();
    }

    this.userService.getUsers(filters).subscribe({
      next: (response: PaginatedResponse<Usuario>) => {
        this.items = response.data;
        this.totalItems = response.meta.total;
        this.totalPages = response.meta.totalPages;
        this.loading = false;
      },
      error: (_: any) => {
        this.loading = false;
        this.errorModalService.show('Erro ao carregar usuários', 'Erro');
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
    this.nameFilter = '';
    this.emailFilter = '';
    this.currentPage = 1;
    this.loadItems();
  }

  editUser(user: Usuario): void {
    this.router.navigate(['/users/edit', user.id]);
  }

  deleteUser(user: Usuario): void {
    this.confirmDelete(user, `Tem certeza que deseja excluir o usuário "${user.nome}"?`);
  }

  protected override deleteItem(id: string) {
    return this.userService.deleteUser(id);
  }
  protected override getId(item: Usuario): string {
    return item.id;
  }
  /** Navegar para criação de usuário */
  createUser(): void {
    this.router.navigate(['/users/new']);
  }
  /** Imprimir informações do usuário */
  printUser(user: Usuario): void {
    window.open(`${environment.apiUrl}/users/${user.id}/print`, '_blank');
  }

  // Métodos para verificar permissões
  canCreateUser(): boolean {
    return this.authService.hasPermission(Permission.USER_CREATE);
  }

  canReadUser(): boolean {
    return this.authService.hasPermission(Permission.USER_READ);
  }

  canPrintUser(): boolean {
    return this.authService.hasPermission(Permission.USER_PRINT);
  }

  canEditUser(): boolean {
    return this.authService.hasPermission(Permission.USER_UPDATE);
  }

  canDeleteUser(): boolean {
    return this.authService.hasPermission(Permission.USER_DELETE);
  }
}
