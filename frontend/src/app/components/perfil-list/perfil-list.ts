import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PerfilService } from '../../services';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { PageContextService } from '../../services/page-context.service';
import {
  Perfil,
  Permission,
  PermissionCatalog,
  PermissionCatalogModule,
  PerfilUsuarioVinculado,
  Unidade,
  Usuario,
} from '../../models/usuario.model';
import { Subject, takeUntil, Observable } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmationModalComponent } from '../confirmation-modal/confirmation-modal';
import { ErrorModalService } from '../../services';
import { environment } from '../../../environments/environment';
import { BaseListComponent } from '../base-list.component';
import {
  AutocompleteComponent,
  AutocompleteItem,
} from '../autocomplete/autocomplete';
import { MenuIconComponent } from '../menu-icon/menu-icon';
import { getPermissionModuleIconKey } from '../../utils/permission-menu-icons';

export interface PerfilModuleChip {
  moduleKey: string;
  moduleLabel: string;
  selected: number;
  total: number;
}

export type FiltroVinculoPerfil = 'todos' | 'com' | 'sem';

@Component({
  selector: 'app-perfil-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ConfirmationModalComponent,
    AutocompleteComponent,
    MenuIconComponent,
  ],
  templateUrl: './perfil-list.html',
  styleUrls: ['./perfil-list.css'],
})
export class PerfilListComponent
  extends BaseListComponent<Perfil>
  implements OnInit, OnDestroy
{
  private perfilService = inject(PerfilService);
  public authService = inject(AuthService);
  private userService = inject(UserService);
  private pageContext = inject(PageContextService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();
  private errorModal: ErrorModalService = inject(ErrorModalService);

  permissionCatalog: PermissionCatalog | null = null;
  moduleChipsByPerfil: Record<string, PerfilModuleChip[]> = {};
  uncatalogedByPerfil: Record<string, number> = {};

  allItems: Perfil[] = [];
  filtroNome = '';
  filtroModuloKey = '';
  filtroVinculo: FiltroVinculoPerfil = 'todos';
  filtroUsuarioId: string | null = null;
  filtroUsuarioLabel = '';
  sortNome: 'asc' | 'desc' = 'asc';

  @ViewChild('usuarioAutocomplete')
  usuarioAutocomplete?: AutocompleteComponent;

  Permission = Permission;
  deleteModalTitle = 'Confirmação de Exclusão';
  deleteModalUsuarios: string[] = [];

  override ngOnInit(): void {
    this.pageContext.setContext({
      title: 'Perfis',
      description: 'Administração — permissões por módulo',
    });
    this.userService
      .getPermissionCatalog()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (catalog) => {
          this.permissionCatalog = catalog;
          super.ngOnInit();
        },
        error: () => {
          this.errorModal.show(
            'Erro ao carregar catálogo de permissões',
            'Erro',
          );
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected override loadItems(): void {
    this.loading = true;
    this.perfilService
      .findAll()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.allItems = data;
          this.items = data;
          this.buildModuleSummaries();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.errorModal.show('Erro ao carregar perfis', 'Erro');
        },
      });
  }

  protected override deleteItem(id: string): Observable<void> {
    return this.perfilService.delete(id);
  }

  protected override getId(item: Perfil): string {
    return item.id;
  }

  editPerfil(perfil: Perfil): void {
    this.router.navigate(['/perfil/edit', perfil.id]);
  }

  duplicatePerfil(perfil: Perfil): void {
    this.router.navigate(['/perfil/new'], {
      queryParams: { copyFrom: perfil.id },
    });
  }

  deletePerfil(perfil: Perfil): void {
    const totalUsuarios = this.getUsuarioCount(perfil);
    if (totalUsuarios === 0) {
      this.executarExclusao(perfil);
      return;
    }

    this.deleteModalUsuarios = this.getUsuariosVinculados(perfil).map((u) =>
      this.formatUsuarioVinculadoLabel(u),
    );
    const rotuloUsuarios =
      totalUsuarios === 1 ? '1 usuário vinculado' : `${totalUsuarios} usuários vinculados`;
    this.confirmDelete(
      perfil,
      `O perfil "${perfil.nomePerfil}" possui ${rotuloUsuarios}. Ao excluir, eles perderão as permissões deste perfil. Deseja continuar?`,
    );
  }

  override onDeleteConfirmed(): void {
    super.onDeleteConfirmed();
    this.deleteModalUsuarios = [];
  }

  override onDeleteCancelled(): void {
    super.onDeleteCancelled();
    this.deleteModalUsuarios = [];
  }

  private executarExclusao(perfil: Perfil): void {
    this.deleteItem(this.getId(perfil))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.loadItems(),
        error: (err: HttpErrorResponse) => {
          const serverMsg = err.error?.message || 'Erro ao excluir';
          this.errorModal.show(serverMsg);
        },
      });
  }

  get displayedItems(): Perfil[] {
    let list = [...this.allItems];

    const nome = this.filtroNome.trim().toLowerCase();
    if (nome) {
      list = list.filter((p) =>
        p.nomePerfil.toLowerCase().includes(nome),
      );
    }

    if (this.filtroModuloKey) {
      list = list.filter((p) => {
        const chip = this.moduleChipsByPerfil[p.id]?.find(
          (c) => c.moduleKey === this.filtroModuloKey,
        );
        return !!chip && chip.selected > 0;
      });
    }

    if (this.filtroVinculo === 'com') {
      list = list.filter((p) => this.getUsuarioCount(p) > 0);
    } else if (this.filtroVinculo === 'sem') {
      list = list.filter((p) => this.getUsuarioCount(p) === 0);
    }

    if (this.filtroUsuarioId) {
      list = list.filter((p) =>
        this.getUsuariosVinculados(p).some(
          (u) => u.id === this.filtroUsuarioId,
        ),
      );
    }

    list.sort((a, b) => {
      const cmp = a.nomePerfil.localeCompare(b.nomePerfil, 'pt-BR', {
        sensitivity: 'base',
      });
      return this.sortNome === 'asc' ? cmp : -cmp;
    });

    return list;
  }

  get hasActiveFilters(): boolean {
    return (
      !!this.filtroNome.trim() ||
      !!this.filtroModuloKey ||
      this.filtroVinculo !== 'todos' ||
      !!this.filtroUsuarioId
    );
  }

  toggleSortNome(): void {
    this.sortNome = this.sortNome === 'asc' ? 'desc' : 'asc';
  }

  limparFiltros(): void {
    this.filtroNome = '';
    this.filtroModuloKey = '';
    this.filtroVinculo = 'todos';
    this.limparFiltroUsuario();
  }

  onUsuarioFiltroSelected(item: AutocompleteItem | null): void {
    if (item && this.isUsuarioAutocompleteItem(item)) {
      this.filtroUsuarioId = item.id;
      this.filtroUsuarioLabel = this.formatUsuarioFiltroLabel(item);
      return;
    }
    this.filtroUsuarioId = null;
    this.filtroUsuarioLabel = '';
  }

  limparFiltroUsuario(): void {
    this.filtroUsuarioId = null;
    this.filtroUsuarioLabel = '';
    this.usuarioAutocomplete?.clearSelection();
  }

  getVinculoFiltroLabel(): string {
    if (this.filtroVinculo === 'com') {
      return 'Com usuários vinculados';
    }
    if (this.filtroVinculo === 'sem') {
      return 'Sem usuários vinculados';
    }
    return 'Todos';
  }

  private isUsuarioAutocompleteItem(item: AutocompleteItem): item is Usuario {
    return 'email' in item;
  }

  formatUsuarioFiltroLabel(usuario: Usuario): string {
    return `${usuario.nome} (${this.formatUnidadeUsuario(usuario.unidade)})`;
  }

  getModuloLabel(key: string): string {
    return (
      this.permissionCatalog?.modules.find((m) => m.key === key)?.label ?? key
    );
  }

  getModuleIconKey(moduleKey: string): string {
    return getPermissionModuleIconKey(moduleKey);
  }

  getUsuarioCount(perfil: Perfil): number {
    return (
      perfil.totalUsuarios ?? perfil.usuariosVinculados?.length ?? 0
    );
  }

  getUsuariosVinculados(perfil: Perfil): PerfilUsuarioVinculado[] {
    return perfil.usuariosVinculados ?? [];
  }

  formatUnidadeUsuario(unidade?: Unidade | null): string {
    return unidade ?? 'Todas';
  }

  formatUsuarioVinculadoLabel(usuario: PerfilUsuarioVinculado): string {
    return `${usuario.nome} (${this.formatUnidadeUsuario(usuario.unidade)})`;
  }

  getChips(perfil: Perfil): PerfilModuleChip[] {
    return this.moduleChipsByPerfil[perfil.id] ?? [];
  }

  getHiddenModulesCount(perfil: Perfil): number {
    const withSelection = this.getChips(perfil).filter((c) => c.selected > 0);
    return Math.max(0, withSelection.length - 3);
  }

  getVisibleChips(perfil: Perfil): PerfilModuleChip[] {
    return this.getChips(perfil)
      .filter((c) => c.selected > 0)
      .slice(0, 3);
  }

  getUncatalogedCount(perfil: Perfil): number {
    return this.uncatalogedByPerfil[perfil.id] ?? 0;
  }

  private buildModuleSummaries(): void {
    if (!this.permissionCatalog) {
      return;
    }

    this.moduleChipsByPerfil = {};
    this.uncatalogedByPerfil = {};

    const cataloged = new Set<Permission>();
    for (const mod of this.permissionCatalog.modules) {
      for (const group of mod.groups) {
        for (const perm of group.permissions) {
          cataloged.add(perm.key);
        }
      }
    }

    for (const perfil of this.allItems) {
      const selected = new Set(perfil.permissoes || []);
      const chips: PerfilModuleChip[] = this.permissionCatalog.modules.map(
        (mod) => ({
          moduleKey: mod.key,
          moduleLabel: mod.label,
          selected: this.countSelectedInModule(mod, selected),
          total: this.countTotalInModule(mod),
        }),
      );
      this.moduleChipsByPerfil[perfil.id] = chips;
      this.uncatalogedByPerfil[perfil.id] = (perfil.permissoes || []).filter(
        (p) => !cataloged.has(p),
      ).length;
    }
  }

  private countSelectedInModule(
    mod: PermissionCatalogModule,
    selected: Set<Permission>,
  ): number {
    return mod.groups
      .flatMap((g) => g.permissions.map((p) => p.key))
      .filter((k) => selected.has(k)).length;
  }

  private countTotalInModule(mod: PermissionCatalogModule): number {
    return mod.groups.reduce((acc, g) => acc + g.permissions.length, 0);
  }

  printPerfil(perfil: Perfil): void {
    const printWindow = window.open(
      '',
      '_blank',
      'width=800,height=600,scrollbars=yes',
    );
    if (printWindow) {
      printWindow.document.write(
        `<!DOCTYPE html><html><head><title>Perfil - ${perfil.nomePerfil}</title>` +
          `<style>
           body { font-family: Arial, sans-serif; padding: 10px; font-size: 12px; }
           h1 { font-size: 18px; margin-bottom: 8px; }
           .print-date { font-size: 10px; color: #555; margin-bottom: 12px; }
           .group { margin-bottom: 6px; }
           .group strong { display: inline-block; width: 180px; vertical-align: top; }
           .users { margin-top: 12px; padding-top: 8px; border-top: 1px solid #ccc; font-weight: bold; }
        </style>` +
          `</head><body><h1>${perfil.nomePerfil}</h1>` +
          `<div class="print-date">Impresso em: ${new Date().toLocaleString('pt-BR')}</div><div id="content"></div></body></html>`,
      );
      fetch(`${environment.apiUrl}/perfil/${perfil.id}/print`, {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('access_token'),
        },
      })
        .then((res) => res.json())
        .then((data: { groups: { group: string; permissions: string[] }[]; users: string[] }) => {
          const container = printWindow.document.getElementById('content');
          if (container) {
            const permissionsTitle = `<h2>Permissões do perfil</h2>`;
            const groupsHtml = data.groups
              .map(
                (g) =>
                  `<div class="group"><strong>${g.group}:</strong> ${g.permissions.join(', ')}</div>`,
              )
              .join('');
            const usersTitle =
              data.users && data.users.length
                ? `<h2>Usuários vinculados</h2>`
                : '';
            const usersHtml =
              data.users && data.users.length
                ? `<div class="users">${data.users.join(', ')}</div>`
                : '';
            container.innerHTML =
              permissionsTitle + groupsHtml + usersTitle + usersHtml;
            setTimeout(() => printWindow.print(), 100);
          }
        });
    }
  }
}
