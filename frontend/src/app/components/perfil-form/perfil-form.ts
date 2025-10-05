import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormsModule } from '@angular/forms';
import { PerfilService } from '../../services/perfil.service';
import { UserService } from '../../services/user.service';
import { Permission } from '../../models/usuario.model';

@Component({
  selector: 'app-perfil-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, FormsModule],
  templateUrl: './perfil-form.html',
  styleUrls: ['./perfil-form.css']
})
export class PerfilFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private perfilService = inject(PerfilService);
  private userService = inject(UserService);
  public router = inject(Router);
  private route = inject(ActivatedRoute);

  perfilForm: FormGroup = this.fb.group({
    nomePerfil: ['', Validators.required],
    permissoes: [[] as Permission[]]
  });
  permissionGroups: Record<string, { key: Permission; label: string }[]> = {};
  // Filter para busca de permissões
  permissionFilter = '';
  filteredPermissionGroups: Record<string, { key: Permission; label: string }[]> = {};
  loading = false;
  error: string | null = null;
  isEditMode = false;
  perfilId: string | null = null;

  ngOnInit(): void {
    // carregar grupos de permissão
    this.userService.getPermissions().subscribe(groups => {
      this.permissionGroups = groups;
      this.filteredPermissionGroups = groups;
    });
    // verificar modo de edição
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.isEditMode = true;
        this.perfilId = params['id'];
        this.loadPerfil();
      }
    });
  }

  private loadPerfil(): void {
    if (!this.perfilId) return;
    this.loading = true;
    this.perfilService.findOne(this.perfilId).subscribe({
      next: perfil => {
        this.perfilForm.patchValue({
          nomePerfil: perfil.nomePerfil,
          permissoes: perfil.permissoes
        });
        this.loading = false;
      },
      error: () => {
        this.error = 'Erro ao carregar perfil';
        this.loading = false;
      }
    });
  }

  onPermissionChange(permission: Permission, checked: boolean): void {
    const perms: Permission[] = this.perfilForm.value.permissoes || [];
    const updated = checked ? [...perms, permission] : perms.filter(p => p !== permission);
    this.perfilForm.get('permissoes')?.setValue(updated);
  }

  onSubmit(): void {
    if (this.perfilForm.invalid) return;
    this.loading = true;
    const data = this.perfilForm.value;
    const request = this.isEditMode && this.perfilId
      ? this.perfilService.update(this.perfilId, data)
      : this.perfilService.create(data);
    request.subscribe({
      next: () => this.router.navigate(['/perfil']),
      error: () => {
        this.error = 'Erro ao salvar perfil';
        this.loading = false;
      }
    });
  }
  
  // Atualiza lista de grupos filtrando por label de permissão
  public onPermissionFilterChange(filter: string): void {
    this.permissionFilter = filter;
    this.filteredPermissionGroups = {};
    Object.entries(this.permissionGroups).forEach(([group, perms]) => {
      const filtered = perms.filter(item => item.label.toLowerCase().includes(filter.toLowerCase()));
      if (filtered.length) {
        this.filteredPermissionGroups[group] = filtered;
      }
    });
  }
  
  // Converte chave de grupo em rótulo amigável: substitui hifens por espaços e capitaliza palavras
  public formatGroupName(key: string): string {
    return key
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  /** Seleciona todas as permissões atualmente filtradas */
  public selectAllFiltered(): void {
    const allKeys = Object.values(this.filteredPermissionGroups)
      .flat()
      .map(item => item.key as Permission);
    const current: Permission[] = this.perfilForm.value.permissoes || [];
    const combined = Array.from(new Set([...current, ...allKeys]));
    this.perfilForm.get('permissoes')?.setValue(combined);
  }

  /** Desmarca todas as permissões atualmente filtradas */
  public deselectAllFiltered(): void {
    const allKeys = Object.values(this.filteredPermissionGroups)
      .flat()
      .map(item => item.key as Permission);
    const current: Permission[] = this.perfilForm.value.permissoes || [];
    const filtered = current.filter(p => !allKeys.includes(p));
    this.perfilForm.get('permissoes')?.setValue(filtered);
  }
  // Verifica se todas as permissões de um grupo estão selecionadas
  public isGroupSelected(groupName: string): boolean {
    const group = this.filteredPermissionGroups[groupName] || [];
    const current: Permission[] = this.perfilForm.value.permissoes || [];
    return group.every(item => current.includes(item.key));
  }

  // Seleciona ou desmarca todas as permissões de um grupo
  public toggleSelectGroup(groupName: string, selected: boolean): void {
    const group = this.filteredPermissionGroups[groupName] || [];
    let perms: Permission[] = this.perfilForm.value.permissoes || [];
    const keys = group.map(item => item.key);
    if (selected) {
      perms = Array.from(new Set([...perms, ...keys]));
    } else {
      perms = perms.filter(p => !keys.includes(p));
    }
    this.perfilForm.get('permissoes')?.setValue(perms);
  }
  
  /** Retorna todas as chaves de permissões atualmente filtradas */
  public get filteredKeys(): Permission[] {
    return Object.values(this.filteredPermissionGroups)
      .flat()
      .map(item => item.key);
  }

  /** Indica se todas as permissões filtradas já estão marcadas */
  public get allFilteredSelected(): boolean {
    const keys = this.filteredKeys;
    const current: Permission[] = this.perfilForm.value.permissoes || [];
    return keys.length > 0 && keys.every(k => current.includes(k));
  }

  /** Indica se alguma das permissões filtradas está marcada */
  public get anyFilteredSelected(): boolean {
    const keys = this.filteredKeys;
    const current: Permission[] = this.perfilForm.value.permissoes || [];
    return keys.some(k => current.includes(k));
  }

}