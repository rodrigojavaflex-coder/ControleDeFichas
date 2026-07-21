import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormsModule,
} from '@angular/forms';
import { PerfilService } from '../../services/perfil.service';
import { UserService } from '../../services/user.service';
import { PageContextService } from '../../services/page-context.service';
import {
  Permission,
  PermissionCatalog,
  PermissionCatalogGroup,
  PermissionCatalogModule,
} from '../../models/usuario.model';
import { MenuIconComponent } from '../menu-icon/menu-icon';
import {
  getPermissionGroupIconKey,
  getPermissionModuleIconKey,
} from '../../utils/permission-menu-icons';

type SelectionFilter = 'all' | 'selected' | 'unselected';

@Component({
  selector: 'app-perfil-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule, MenuIconComponent],
  templateUrl: './perfil-form.html',
  styleUrls: ['./perfil-form.css'],
})
export class PerfilFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private perfilService = inject(PerfilService);
  private userService = inject(UserService);
  private pageContext = inject(PageContextService);
  public router = inject(Router);
  private route = inject(ActivatedRoute);

  perfilForm: FormGroup = this.fb.group({
    nomePerfil: ['', Validators.required],
    permissoes: [[] as Permission[]],
  });

  permissionCatalog: PermissionCatalog | null = null;
  permissionFilter = '';
  selectionFilter: SelectionFilter = 'all';
  /** Filtro por módulo (vazio = todos). */
  filterModuleKey = '';
  /** Filtro por tela/grupo dentro do módulo (vazio = todas). */
  filterGroupKey = '';
  expandedModules = new Set<string>();

  loading = false;
  error: string | null = null;
  isEditMode = false;
  perfilId: string | null = null;
  copyFromId: string | null = null;

  ngOnInit(): void {
    this.userService.getPermissionCatalog().subscribe({
      next: (catalog) => {
        this.permissionCatalog = catalog;
        if (this.expandedModules.size === 0 && catalog.modules.length) {
          this.expandedModules.add(catalog.modules[0].key);
        }
      },
      error: () => {
        this.error = 'Erro ao carregar catálogo de permissões';
      },
    });

    this.route.params.subscribe((params) => {
      if (params['id']) {
        this.isEditMode = true;
        this.perfilId = params['id'];
        this.pageContext.setContext({
          title: 'Editar perfil',
          description: 'Administração',
        });
        this.loadPerfil();
        return;
      }
      this.pageContext.setContext({
        title: 'Novo perfil',
        description: 'Administração',
      });
    });

    this.route.queryParams.subscribe((query) => {
      const copyFrom = query['copyFrom'];
      if (copyFrom && !this.isEditMode) {
        this.copyFromId = copyFrom;
        this.loadCopySource(copyFrom);
      }
    });
  }

  get selectedPermissions(): Permission[] {
    return this.perfilForm.value.permissoes || [];
  }

  get totalSelected(): number {
    return this.selectedPermissions.length;
  }

  get totalPermissions(): number {
    return this.permissionCatalog?.totalPermissions ?? 0;
  }

  get moduleFilterOptions(): PermissionCatalogModule[] {
    return this.permissionCatalog?.modules ?? [];
  }

  /** Telas/grupos do módulo selecionado no combo. */
  get groupFilterOptions(): PermissionCatalogGroup[] {
    if (!this.filterModuleKey || !this.permissionCatalog) {
      return [];
    }
    const mod = this.permissionCatalog.modules.find(
      (m) => m.key === this.filterModuleKey,
    );
    return mod?.groups ?? [];
  }

  get hasActiveLocationFilter(): boolean {
    return !!this.filterModuleKey || !!this.filterGroupKey;
  }

  get filteredModules(): PermissionCatalogModule[] {
    if (!this.permissionCatalog) {
      return [];
    }
    const term = this.permissionFilter.trim().toLowerCase();
    return this.permissionCatalog.modules
      .map((mod) => this.filterModule(mod, term))
      .filter((mod): mod is PermissionCatalogModule => mod !== null);
  }

  private filterModule(
    mod: PermissionCatalogModule,
    term: string,
  ): PermissionCatalogModule | null {
    if (this.filterModuleKey && mod.key !== this.filterModuleKey) {
      return null;
    }

    const selected = new Set(this.selectedPermissions);
    const moduleMatches =
      !term ||
      mod.label.toLowerCase().includes(term) ||
      mod.key === this.filterModuleKey;

    const groups = mod.groups
      .map((group) => {
        if (this.filterGroupKey && group.key !== this.filterGroupKey) {
          return null;
        }
        const groupMatches =
          moduleMatches || group.label.toLowerCase().includes(term);
        const permissions = group.permissions.filter((perm) => {
          const labelMatches =
            groupMatches || perm.label.toLowerCase().includes(term);
          if (!labelMatches) {
            return false;
          }
          if (this.selectionFilter === 'selected') {
            return selected.has(perm.key);
          }
          if (this.selectionFilter === 'unselected') {
            return !selected.has(perm.key);
          }
          return true;
        });
        return permissions.length ? { ...group, permissions } : null;
      })
      .filter((g): g is PermissionCatalogGroup => g !== null);

    return groups.length ? { ...mod, groups } : null;
  }

  private loadPerfil(): void {
    if (!this.perfilId) return;
    this.loading = true;
    this.perfilService.findOne(this.perfilId).subscribe({
      next: (perfil) => {
        this.perfilForm.patchValue({
          nomePerfil: perfil.nomePerfil,
          permissoes: perfil.permissoes,
        });
        this.expandModulesWithSelection();
        this.loading = false;
      },
      error: () => {
        this.error = 'Erro ao carregar perfil';
        this.loading = false;
      },
    });
  }

  private loadCopySource(id: string): void {
    this.loading = true;
    this.perfilService.findOne(id).subscribe({
      next: (perfil) => {
        this.perfilForm.patchValue({
          nomePerfil: `${perfil.nomePerfil} (cópia)`,
          permissoes: [...perfil.permissoes],
        });
        this.expandModulesWithSelection();
        this.loading = false;
      },
      error: () => {
        this.error = 'Erro ao carregar perfil para duplicar';
        this.loading = false;
      },
    });
  }

  private expandModulesWithSelection(): void {
    if (!this.permissionCatalog) return;
    const selected = new Set(this.selectedPermissions);
    for (const mod of this.permissionCatalog.modules) {
      const hasSelected = mod.groups.some((g) =>
        g.permissions.some((p) => selected.has(p.key)),
      );
      if (hasSelected) {
        this.expandedModules.add(mod.key);
      }
    }
  }

  getModuleIconKey(moduleKey: string): string {
    return getPermissionModuleIconKey(moduleKey);
  }

  getGroupIconKey(groupKey: string): string {
    return getPermissionGroupIconKey(groupKey);
  }

  isModuleExpanded(moduleKey: string): boolean {
    return this.expandedModules.has(moduleKey);
  }

  toggleModuleExpanded(moduleKey: string): void {
    if (this.expandedModules.has(moduleKey)) {
      this.expandedModules.delete(moduleKey);
    } else {
      this.expandedModules.add(moduleKey);
    }
  }

  modulePermissionKeys(mod: PermissionCatalogModule): Permission[] {
    return mod.groups.flatMap((g) => g.permissions.map((p) => p.key));
  }

  countSelectedInModule(mod: PermissionCatalogModule): number {
    const selected = new Set(this.selectedPermissions);
    return this.modulePermissionKeys(mod).filter((k) => selected.has(k)).length;
  }

  countTotalInModule(mod: PermissionCatalogModule): number {
    return this.modulePermissionKeys(mod).length;
  }

  countUnselectedInModule(mod: PermissionCatalogModule): number {
    return this.countTotalInModule(mod) - this.countSelectedInModule(mod);
  }

  selectModuleAll(mod: PermissionCatalogModule): void {
    this.toggleSelectModule(mod, true);
  }

  deselectModuleAll(mod: PermissionCatalogModule): void {
    this.toggleSelectModule(mod, false);
  }

  isPermissionChecked(permission: Permission): boolean {
    return this.selectedPermissions.includes(permission);
  }

  onPermissionChange(permission: Permission, checked: boolean): void {
    const perms = [...this.selectedPermissions];
    const updated = checked
      ? [...perms, permission]
      : perms.filter((p) => p !== permission);
    this.perfilForm.get('permissoes')?.setValue(Array.from(new Set(updated)));
  }

  groupPermissionKeys(group: PermissionCatalogGroup): Permission[] {
    return group.permissions.map((p) => p.key);
  }

  isGroupSelected(group: PermissionCatalogGroup): boolean {
    const keys = this.groupPermissionKeys(group);
    const current = this.selectedPermissions;
    return keys.length > 0 && keys.every((k) => current.includes(k));
  }

  isGroupIndeterminate(group: PermissionCatalogGroup): boolean {
    const keys = this.groupPermissionKeys(group);
    const current = new Set(this.selectedPermissions);
    const selectedCount = keys.filter((k) => current.has(k)).length;
    return selectedCount > 0 && selectedCount < keys.length;
  }

  toggleSelectGroup(group: PermissionCatalogGroup, selected: boolean): void {
    const keys = this.groupPermissionKeys(group);
    let perms = [...this.selectedPermissions];
    if (selected) {
      perms = Array.from(new Set([...perms, ...keys]));
    } else {
      perms = perms.filter((p) => !keys.includes(p));
    }
    this.perfilForm.get('permissoes')?.setValue(perms);
  }

  toggleSelectModule(mod: PermissionCatalogModule, selected: boolean): void {
    const keys = this.modulePermissionKeys(mod);
    let perms = [...this.selectedPermissions];
    if (selected) {
      perms = Array.from(new Set([...perms, ...keys]));
    } else {
      perms = perms.filter((p) => !keys.includes(p));
    }
    this.perfilForm.get('permissoes')?.setValue(perms);
  }

  onPermissionFilterChange(filter: string): void {
    this.permissionFilter = filter;
  }

  onFilterModuleChange(moduleKey: string): void {
    this.filterModuleKey = moduleKey;
    this.filterGroupKey = '';
    if (moduleKey) {
      this.expandedModules.add(moduleKey);
    }
  }

  onFilterGroupChange(groupKey: string): void {
    this.filterGroupKey = groupKey;
    if (this.filterModuleKey) {
      this.expandedModules.add(this.filterModuleKey);
    }
  }

  clearLocationFilters(): void {
    this.filterModuleKey = '';
    this.filterGroupKey = '';
  }

  setSelectionFilter(filter: SelectionFilter): void {
    this.selectionFilter = filter;
  }

  get filteredPermissionKeys(): Permission[] {
    return this.filteredModules.flatMap((mod) => this.modulePermissionKeys(mod));
  }

  get filteredPermissionsCount(): number {
    return this.filteredPermissionKeys.length;
  }

  get filteredSelectedCount(): number {
    const keys = new Set(this.filteredPermissionKeys);
    return this.selectedPermissions.filter((p) => keys.has(p)).length;
  }

  get filteredUnselectedCount(): number {
    return this.filteredPermissionsCount - this.filteredSelectedCount;
  }

  selectAllFiltered(): void {
    const keys = this.filteredPermissionKeys;
    const combined = Array.from(
      new Set([...this.selectedPermissions, ...keys]),
    );
    this.perfilForm.get('permissoes')?.setValue(combined);
  }

  deselectAllFiltered(): void {
    const keys = new Set(this.filteredPermissionKeys);
    const filtered = this.selectedPermissions.filter((p) => !keys.has(p));
    this.perfilForm.get('permissoes')?.setValue(filtered);
  }

  get allFilteredSelected(): boolean {
    const keys = this.filteredPermissionKeys;
    const current = this.selectedPermissions;
    return keys.length > 0 && keys.every((k) => current.includes(k));
  }

  get anyFilteredSelected(): boolean {
    const keys = this.filteredPermissionKeys;
    const current = this.selectedPermissions;
    return keys.some((k) => current.includes(k));
  }

  expandAllModules(): void {
    if (!this.permissionCatalog) return;
    for (const mod of this.permissionCatalog.modules) {
      this.expandedModules.add(mod.key);
    }
  }

  collapseAllModules(): void {
    this.expandedModules.clear();
  }

  onSubmit(): void {
    if (this.perfilForm.invalid) return;
    this.loading = true;
    this.error = null;
    const data = this.perfilForm.value;
    const request =
      this.isEditMode && this.perfilId
        ? this.perfilService.update(this.perfilId, data)
        : this.perfilService.create(data);
    request.subscribe({
      next: () => this.router.navigate(['/perfil']),
      error: () => {
        this.error = 'Erro ao salvar perfil';
        this.loading = false;
      },
    });
  }
}
