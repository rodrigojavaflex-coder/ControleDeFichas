import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { User, PaginatedResponse, FindUsersDto, Permission } from '../../models/user.model';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';

@Component({
  selector: 'app-user-list',
  imports: [CommonModule, FormsModule, ConfirmationModalComponent],
  templateUrl: './user-list.html',
  styleUrl: './user-list.css'
})
export class UserListComponent implements OnInit {
  users: User[] = [];
  loading = false;
  error: string | null = null;

  // Paginação
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  totalPages = 0;

  // Filtros
  nameFilter = '';
  emailFilter = '';

  // Modal de confirmação
  showDeleteModal = false;
  userToDelete: User | null = null;
  deleteModalTitle = 'Confirmação de Exclusão';
  deleteModalMessage = '';

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = null;

    const filters: FindUsersDto = {
      page: this.currentPage,
      limit: this.pageSize
    };

    if (this.nameFilter.trim()) {
      filters.name = this.nameFilter.trim();
    }

    if (this.emailFilter.trim()) {
      filters.email = this.emailFilter.trim();
    }

    this.userService.getUsers(filters).subscribe({
      next: (response: PaginatedResponse<User>) => {
        this.users = response.data;
        this.totalItems = response.meta.total;
        this.totalPages = response.meta.totalPages;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Erro ao carregar usuários';
        this.loading = false;
        console.error('Erro:', err);
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadUsers();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  clearFilters(): void {
    this.nameFilter = '';
    this.emailFilter = '';
    this.currentPage = 1;
    this.loadUsers();
  }

  editUser(user: User): void {
    this.router.navigate(['/users/edit', user.id]);
  }

  deleteUser(user: User): void {
    this.userToDelete = user;
    this.deleteModalMessage = `Tem certeza que deseja excluir o usuário "${user.name}"?\n\nEsta ação não pode ser desfeita.`;
    this.showDeleteModal = true;
  }

  onDeleteConfirmed(): void {
    if (this.userToDelete) {
      this.userService.deleteUser(this.userToDelete.id).subscribe({
        next: () => {
          this.loadUsers();
          this.closeDeleteModal();
        },
        error: (err) => {
          this.error = 'Erro ao excluir usuário';
          console.error('Erro:', err);
          this.closeDeleteModal();
        }
      });
    }
  }

  onDeleteCancelled(): void {
    this.closeDeleteModal();
  }

  private closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.userToDelete = null;
    this.deleteModalMessage = '';
  }

  createUser(): void {
    console.log('createUser called - navigating to /users/new');
    this.router.navigate(['/users/new']);
  }

  printUser(user: User): void {
    // Abrir nova janela com o componente de impressão
    const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Relatório de Usuário - ${user.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .loading { text-align: center; padding: 50px; }
          </style>
        </head>
        <body>
          <div class="loading">Carregando dados para impressão...</div>
          <div id="print-content"></div>
          <script>
            // Carregar dados do usuário
            fetch('http://localhost:3000/api/users/${user.id}/print', {
              headers: {
                'Authorization': 'Bearer ' + localStorage.getItem('access_token')
              }
            })
            .then(response => response.json())
            .then(data => {
              document.querySelector('.loading').style.display = 'none';
              document.getElementById('print-content').innerHTML = generatePrintHTML(data);
              setTimeout(() => window.print(), 100);
            })
            .catch(error => {
              document.querySelector('.loading').innerHTML = 'Erro ao carregar dados: ' + error.message;
            });

            function generatePrintHTML(userData) {
              let permissionsHTML = '';
              if (userData.permissions && userData.permissions.length > 0) {
                permissionsHTML = userData.permissions.map(group => {
                  return '<div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-left: 4px solid #28a745;">' +
                    '<h3 style="margin: 0 0 10px 0; color: #495057;">' + group.group + '</h3>' +
                    '<ul style="margin: 0; padding-left: 20px;">' +
                    group.permissions.map(p => '<li style="margin-bottom: 5px;">' + p + '</li>').join('') +
                    '</ul></div>';
                }).join('');
              } else {
                permissionsHTML = '<p style="text-align: center; color: #666; font-style: italic; padding: 20px; background: #f8f9fa; border: 2px dashed #ddd;">Este usuário não possui permissões atribuídas.</p>';
              }

              return '<div style="max-width: 21cm; margin: 0 auto; font-family: Arial, sans-serif;">' +
                '<div style="text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 3px solid #007bff;">' +
                  '<h1 style="color: #007bff; font-size: 28px; margin: 0;">Relatório de Usuário</h1>' +
                  '<div style="margin-top: 10px; font-size: 14px; color: #666;">Impresso em: ' + new Date(userData.printedAt).toLocaleString('pt-BR') + '</div>' +
                '</div>' +
                '<div style="margin-bottom: 30px;">' +
                  '<h2 style="color: #007bff; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">Informações do Usuário</h2>' +
                  '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">' +
                    '<div style="padding: 12px; background: #f8f9fa; border-left: 4px solid #007bff;"><strong>ID:</strong> ' + userData.id + '</div>' +
                    '<div style="padding: 12px; background: #f8f9fa; border-left: 4px solid #007bff;"><strong>Nome:</strong> ' + userData.name + '</div>' +
                    '<div style="padding: 12px; background: #f8f9fa; border-left: 4px solid #007bff;"><strong>Email:</strong> ' + userData.email + '</div>' +
                    '<div style="padding: 12px; background: #f8f9fa; border-left: 4px solid #007bff;"><strong>Status:</strong> <span style="color: ' + (userData.isActive ? '#28a745' : '#dc3545') + '; font-weight: bold;">' + (userData.isActive ? 'Ativo' : 'Inativo') + '</span></div>' +
                    '<div style="padding: 12px; background: #f8f9fa; border-left: 4px solid #007bff;"><strong>Criado em:</strong> ' + new Date(userData.createdAt).toLocaleString('pt-BR') + '</div>' +
                    '<div style="padding: 12px; background: #f8f9fa; border-left: 4px solid #007bff;"><strong>Atualizado em:</strong> ' + new Date(userData.updatedAt).toLocaleString('pt-BR') + '</div>' +
                  '</div>' +
                '</div>' +
                '<div style="margin-bottom: 30px;">' +
                  '<h2 style="color: #007bff; font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #e9ecef; padding-bottom: 8px;">Permissões (' + userData.totalPermissions + ' total)</h2>' +
                  permissionsHTML +
                '</div>' +
                '<div style="margin-top: 40px; padding-top: 15px; border-top: 2px solid #ddd; text-align: center;">' +
                  '<p style="color: #666; font-size: 12px; margin: 0;">Este relatório foi gerado automaticamente pelo Sistema de Gestão de Usuários</p>' +
                '</div>' +
              '</div>';
            }
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
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
