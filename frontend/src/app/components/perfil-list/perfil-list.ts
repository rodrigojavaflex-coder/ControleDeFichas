import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PerfilService } from '../../services';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { Perfil, Permission } from '../../models/usuario.model';
import { Subject, takeUntil } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-perfil-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ConfirmationModalComponent],
  templateUrl: './perfil-list.html',
  styleUrls: ['./perfil-list.css']
})
export class PerfilListComponent implements OnInit, OnDestroy {
  private perfilService = inject(PerfilService);
  public authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  perfis: Perfil[] = [];
  loading = false;
  error: string | null = null;

  // Mapeamento de permissões e labels
  permissionGroups: Record<string, { key: Permission; label: string }[]> = {};
  formattedPermissoes: Record<string, string> = {};

  Permission = Permission;

  // Modal de confirmação
  showDeleteModal = false;
  perfilToDelete: Perfil | null = null;
  deleteModalTitle = 'Confirmação de Exclusão';
  deleteModalMessage = '';

  // Modal de erro
  showErrorModal = false;
  errorModalTitle = 'Erro ao excluir perfil';
  errorModalMessage = '';

  ngOnInit(): void {
    // Carregar descrições de permissões antes de buscar perfis
    this.userService.getPermissions()
      .pipe(takeUntil(this.destroy$))
      .subscribe(groups => {
        this.permissionGroups = groups;
        this.loadPerfis();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next(); this.destroy$.complete();
  }

  loadPerfis(): void {
  this.loading = true;
  this.error = null;
    this.perfilService.findAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.perfis = data;
          this.formatarPermissoes();
          this.loading = false;
        },
        error: () => { this.loading = false; this.error = 'Erro ao carregar perfis'; }
      });
  }

  createPerfil(): void {
    this.router.navigate(['/perfil/new']);
  }

  editPerfil(perfil: Perfil): void {
    this.router.navigate(['/perfil/edit', perfil.id]);
  }

  deletePerfil(perfil: Perfil): void {
    this.perfilToDelete = perfil;
    this.deleteModalMessage = `Tem certeza que deseja excluir o perfil "${perfil.nomePerfil}"?\n\nEsta ação não pode ser desfeita.`;
    this.showDeleteModal = true;
  }

  onDeleteConfirmed(): void {
    if (this.perfilToDelete) {
      this.perfilService.delete(this.perfilToDelete.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadPerfis();
            this.closeDeleteModal();
          },
          error: (err: HttpErrorResponse) => {
            // Mostrar modal de erro com mensagem do backend
            const m = err.error && err.error.message;
            this.errorModalMessage = Array.isArray(m) ? m.join(', ') : (m || 'Erro ao excluir perfil');
            this.closeDeleteModal();
            this.showErrorModal = true;
          }
        });
    }
  }

  onDeleteCancelled(): void {
    this.closeDeleteModal();
  }

  private closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.perfilToDelete = null;
    this.deleteModalMessage = '';
  }

  // fecha modal de erro
  closeErrorModal(): void {
    this.showErrorModal = false;
    this.errorModalMessage = '';
  }

  // Converte chaves de permissão em labels amigáveis para exibição
  private formatarPermissoes(): void {
    const mapLabels = new Map<Permission, string>();
    Object.values(this.permissionGroups).forEach(group => {
      group.forEach(item => mapLabels.set(item.key, item.label));
    });
    this.formattedPermissoes = {};
    this.perfis.forEach(perfil => {
      const labels = perfil.permissoes
        .map(p => mapLabels.get(p) || p)
        .join(', ');
      this.formattedPermissoes[perfil.id] = labels;
    });
  }

  printPerfil(perfil: Perfil): void {
    const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
    if (printWindow) {
      printWindow.document.write(
        `<!DOCTYPE html><html><head><title>Perfil - ${perfil.nomePerfil}</title>`+
        `<style>
           body { font-family: Arial, sans-serif; padding: 10px; font-size: 12px; }
           h1 { font-size: 18px; margin-bottom: 8px; }
           .print-date { font-size: 10px; color: #555; margin-bottom: 12px; }
           .group { margin-bottom: 6px; }
           .group strong { display: inline-block; width: 120px; }
           .users { margin-top: 12px; padding-top: 8px; border-top: 1px solid #ccc; font-weight: bold; }
           .users strong { display: inline-block; width: 120px; }
        </style>`+
        `</head><body><h1>${perfil.nomePerfil}</h1>`+
        `<div class="print-date">Impresso em: ${new Date().toLocaleString('pt-BR')}</div><div id="content"></div></body></html>`
      );
      // Carregar dados de impressão
  fetch(`${environment.apiUrl}/perfil/${perfil.id}/print`, {
        headers: { 'Authorization': 'Bearer ' + localStorage.getItem('access_token') }
      })
      .then(res => res.json())
      .then((data: any) => {
        const container = printWindow.document.getElementById('content');
        if (container) {
          // Título de permissões
          const permissionsTitle = `<h2>Lista de permissões "${perfil.nomePerfil}"</h2>`;
          // HTML das permissões
          const groupsHtml = data.groups.map((g: any) =>
              `<div class="group"><strong>${g.group}:</strong> ${g.permissions.join(', ')}</div>`
          ).join('');
          // Título de usuários
          const usersTitle = data.users && data.users.length
              ? `<h2>Usuários do Perfil:</h2>` : '';
          // HTML dos usuários
          const usersHtml = data.users && data.users.length
              ? `<div class="users">${data.users.join(', ')}</div>` : '';
          // Monta o conteúdo completo
          container.innerHTML = permissionsTitle + groupsHtml + usersTitle + usersHtml;
          setTimeout(() => printWindow.print(), 100);
        }
      });
    }
  }
}