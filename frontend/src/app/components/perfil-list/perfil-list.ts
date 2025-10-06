import { Component, OnDestroy, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PerfilService } from '../../services';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { Perfil, Permission } from '../../models/usuario.model';
import { Subject, takeUntil, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { ErrorModalService } from '../../services';
import { environment } from '../../../environments/environment';
import { BaseListComponent } from '../base-list.component';

@Component({
  selector: 'app-perfil-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ConfirmationModalComponent],
  templateUrl: './perfil-list.html',
  styleUrls: ['./perfil-list.css']
})
export class PerfilListComponent extends BaseListComponent<Perfil> implements OnDestroy {
  private perfilService = inject(PerfilService);
  public authService = inject(AuthService);
  private userService = inject(UserService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  // Serviço de modal de erro genérico
  private errorModal: ErrorModalService = inject(ErrorModalService);


  // Mapeamento de permissões e labels
  permissionGroups: Record<string, { key: Permission; label: string }[]> = {};
  formattedPermissoes: Record<string, string> = {};

  Permission = Permission;
  /** Título do modal de confirmação de exclusão */
  deleteModalTitle = 'Confirmação de Exclusão';

  // Estados de erro local removidos, usando ErrorModalService



  override ngOnInit(): void {
    this.userService.getPermissions()
      .pipe(takeUntil(this.destroy$))
      .subscribe(groups => {
        this.permissionGroups = groups;
        super.ngOnInit();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next(); this.destroy$.complete();
  }

  protected override loadItems(): void {
    this.loading = true;
    this.perfilService.findAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: data => { this.items = data; this.formatarPermissoes(); this.loading = false; },
        error: (_: any) => {
          this.loading = false;
          this.errorModal.show('Erro ao carregar perfis', 'Erro');
        }
      });
  }

  /** Implementação de deleteItem abstrato do BaseListComponent */
  protected override deleteItem(id: string): Observable<void> {
    return this.perfilService.delete(id);
  }

  /** Implementação de getId abstrato do BaseListComponent */
  protected override getId(item: Perfil): string {
    return item.id;
  }

  createPerfil(): void {
    this.router.navigate(['/perfil/new']);
  }

  editPerfil(perfil: Perfil): void {
    this.router.navigate(['/perfil/edit', perfil.id]);
  }

  // Confirmar exclusão via BaseListComponent
  deletePerfil(perfil: Perfil): void {
    this.confirmDelete(perfil, `Tem certeza que deseja excluir o perfil "${perfil.nomePerfil}"?`);
  }


  // Navegação padrão
  create(): void {
    this.router.navigate(['/perfil/new']);
  }
  edit(item: Perfil): void {
    this.router.navigate(['/perfil/edit', item.id]);
  }

  // Converte chaves de permissão em labels amigáveis para exibição
  private formatarPermissoes(): void {
    const mapLabels = new Map<Permission, string>();
    Object.values(this.permissionGroups).forEach(group => {
      group.forEach(item => mapLabels.set(item.key, item.label));
    });
    this.formattedPermissoes = {};
    this.items.forEach(perfil => {
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