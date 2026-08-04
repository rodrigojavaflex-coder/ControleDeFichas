import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { Unidade, Usuario } from '../../models/usuario.model';

export interface PerfilVincularUsuariosConfirm {
  adicionar: string[];
  remover: string[];
}

interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  unidade?: Unidade | null;
  linked: boolean;
  checked: boolean;
  markedRemove: boolean;
  checkboxDisabled: boolean;
}

@Component({
  selector: 'app-perfil-vincular-usuarios-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil-vincular-usuarios-modal.html',
  styleUrls: ['./perfil-vincular-usuarios-modal.css'],
})
export class PerfilVincularUsuariosModalComponent implements OnChanges {
  private userService = inject(UserService);

  @Input() visible = false;
  @Input() perfilNome = '';
  @Input() alreadyLinkedIds: string[] = [];
  @Input() canAssignUsers = false;
  @Input() canUnassignUsers = false;

  @Output() closed = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<PerfilVincularUsuariosConfirm>();

  filtro = '';
  loadingUsers = false;
  loadUsersError: string | null = null;
  saving = false;
  inlineError: string | null = null;
  rows: UsuarioRow[] = [];
  private alreadyLinkedIdsKey = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.resetState();
      this.alreadyLinkedIdsKey = this.snapshotLinkedIdsKey();
      this.loadAllUsers();
      return;
    }
    if (
      changes['alreadyLinkedIds'] &&
      this.visible &&
      this.rows.length > 0
    ) {
      const key = this.snapshotLinkedIdsKey();
      if (key !== this.alreadyLinkedIdsKey) {
        this.alreadyLinkedIdsKey = key;
        this.syncRowsFromLinkedIds();
      }
    }
  }

  setSaving(value: boolean): void {
    this.saving = value;
  }

  setError(message: string | null): void {
    this.inlineError = message;
    this.saving = false;
  }

  get adicionarIds(): string[] {
    return this.rows
      .filter((r) => !r.linked && r.checked)
      .map((r) => r.id);
  }

  get removerIds(): string[] {
    return this.rows.filter((r) => r.markedRemove).map((r) => r.id);
  }

  get hasChanges(): boolean {
    return this.adicionarIds.length > 0 || this.removerIds.length > 0;
  }

  get confirmLabel(): string {
    const add = this.adicionarIds.length;
    const rem = this.removerIds.length;
    if (add > 0 && rem > 0) {
      return 'Aplicar alterações';
    }
    if (rem > 0) {
      return 'Remover vínculos';
    }
    return 'Vincular';
  }

  get footerSummary(): string {
    const add = this.adicionarIds.length;
    const rem = this.removerIds.length;
    const parts: string[] = [];
    if (add > 0) {
      parts.push(
        add === 1 ? '1 novo vínculo' : `${add} novos vínculos`,
      );
    }
    if (rem > 0) {
      parts.push(
        rem === 1 ? '1 remoção' : `${rem} remoções`,
      );
    }
    return parts.join(' · ');
  }

  get filteredRows(): UsuarioRow[] {
    const q = this.filtro.trim().toLowerCase();
    if (!q) {
      return this.rows;
    }
    return this.rows.filter(
      (r) =>
        r.nome.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q),
    );
  }

  onClose(): void {
    if (this.saving) {
      return;
    }
    this.closed.emit();
  }

  onRowClick(row: UsuarioRow, event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('input[type="checkbox"]')) {
      return;
    }
    this.applyRowChecked(row, !row.checked);
  }

  onCheckboxChange(row: UsuarioRow, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.applyRowChecked(row, input.checked);
  }

  private applyRowChecked(row: UsuarioRow, checked: boolean): void {
    if (row.checkboxDisabled || this.saving) {
      return;
    }
    if (row.linked) {
      if (!this.canUnassignUsers) {
        return;
      }
      row.checked = checked;
      row.markedRemove = !checked;
      return;
    }
    if (!this.canAssignUsers) {
      return;
    }
    row.checked = checked;
  }

  private snapshotLinkedIdsKey(): string {
    return [...this.alreadyLinkedIds].sort().join('|');
  }

  onConfirmClick(): void {
    if (!this.hasChanges || this.saving) {
      return;
    }
    if (this.adicionarIds.length > 0 && !this.canAssignUsers) {
      return;
    }
    if (this.removerIds.length > 0 && !this.canUnassignUsers) {
      return;
    }
    this.inlineError = null;
    this.saving = true;
    this.confirm.emit({
      adicionar: this.adicionarIds,
      remover: this.removerIds,
    });
  }

  formatUnidade(unidade?: Unidade | null): string {
    return unidade ?? 'Todas';
  }

  private resetState(): void {
    this.filtro = '';
    this.loadUsersError = null;
    this.inlineError = null;
    this.saving = false;
    this.rows = [];
  }

  private syncRowsFromLinkedIds(): void {
    const linkedSet = new Set(this.alreadyLinkedIds);
    for (const row of this.rows) {
      const linked = linkedSet.has(row.id);
      row.linked = linked;
      row.checked = linked;
      row.markedRemove = false;
      row.checkboxDisabled =
        linked && !this.canUnassignUsers
          ? true
          : !linked && !this.canAssignUsers;
    }
  }

  private buildRows(usuarios: Usuario[]): void {
    const linkedSet = new Set(this.alreadyLinkedIds);
    this.rows = usuarios
      .map((u) => {
        const linked = linkedSet.has(u.id);
        const checkboxDisabled =
          linked && !this.canUnassignUsers
            ? true
            : !linked && !this.canAssignUsers;
        return {
          id: u.id,
          nome: u.nome,
          email: u.email,
          unidade: u.unidade,
          linked,
          checked: linked,
          markedRemove: false,
          checkboxDisabled,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  private loadAllUsers(): void {
    this.loadingUsers = true;
    this.loadUsersError = null;
    const pageSize = 100;

    const loadPage = (page: number, acc: Usuario[]): void => {
      this.userService.getUsers({ page, limit: pageSize }).subscribe({
        next: (res) => {
          const merged = [...acc, ...res.data];
          if (res.meta.hasNextPage) {
            loadPage(page + 1, merged);
          } else {
            this.buildRows(merged);
            this.loadingUsers = false;
          }
        },
        error: () => {
          this.loadingUsers = false;
          this.loadUsersError =
            'Não foi possível carregar a lista de usuários.';
        },
      });
    };

    loadPage(1, []);
  }
}
