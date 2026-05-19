import { Injectable, inject } from '@angular/core';
import { Observable, tap, map } from 'rxjs';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import {
  DEFAULT_HOME_SHORTCUT_IDS,
  HOME_SHORTCUTS_CATALOG,
  HOME_SHORTCUTS_MAX,
  HomeShortcutDef,
  getHomeShortcutById,
} from '../config/home-shortcuts.registry';

@Injectable({ providedIn: 'root' })
export class HomeShortcutsService {
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly storagePrefix = 'home_shortcuts_';
  private readonly migratedUserIds = new Set<string>();

  /** Atalhos que o usuário pode usar (permissão). */
  getAllowedShortcuts(): HomeShortcutDef[] {
    return HOME_SHORTCUTS_CATALOG.filter((s) => this.canAccess(s));
  }

  /** IDs salvos (banco) ou padrão, já filtrados por permissão e limite. */
  getActiveShortcutIds(_userId: string | undefined): string[] {
    const user = this.auth.getCurrentUser();
    if (!user?.id) return [];

    const fromDb = user.atalhosHome;
    if (fromDb !== null && fromDb !== undefined) {
      return this.sanitizeIds(fromDb);
    }

    const fromLocal = this.loadLocalIds(user.id);
    if (fromLocal?.length) {
      this.scheduleLocalStorageMigration(user.id, fromLocal);
      return this.sanitizeIds(fromLocal);
    }

    return this.sanitizeIds([...DEFAULT_HOME_SHORTCUT_IDS]);
  }

  resolveShortcuts(ids: string[]): HomeShortcutDef[] {
    const out: HomeShortcutDef[] = [];
    for (const id of ids) {
      const def = getHomeShortcutById(id);
      if (def && this.canAccess(def)) {
        out.push(def);
      }
    }
    return out;
  }

  getActiveShortcuts(userId: string | undefined): HomeShortcutDef[] {
    return this.resolveShortcuts(this.getActiveShortcutIds(userId));
  }

  saveShortcutIds(userId: string, ids: string[]): Observable<void> {
    const sanitized = this.sanitizeIds(ids);
    return this.userService.updateAtalhosHome(userId, sanitized).pipe(
      tap((usuario) => {
        this.auth.updateCurrentUserAtalhosHome(usuario.atalhosHome ?? sanitized);
        this.clearLocal(userId);
      }),
      map(() => void 0),
    );
  }

  getDefaultIds(): string[] {
    return this.sanitizeIds([...DEFAULT_HOME_SHORTCUT_IDS]);
  }

  sanitizeIds(ids: string[]): string[] {
    const allowed = new Set(this.getAllowedShortcuts().map((s) => s.id));
    const seen = new Set<string>();
    const result: string[] = [];
    for (const id of ids) {
      if (!allowed.has(id) || seen.has(id)) continue;
      seen.add(id);
      result.push(id);
      if (result.length >= HOME_SHORTCUTS_MAX) break;
    }
    return result;
  }

  private scheduleLocalStorageMigration(userId: string, ids: string[]): void {
    if (this.migratedUserIds.has(userId)) return;
    this.migratedUserIds.add(userId);

    const sanitized = this.sanitizeIds(ids);
    this.userService.updateAtalhosHome(userId, sanitized).subscribe({
      next: (usuario) => {
        this.auth.updateCurrentUserAtalhosHome(usuario.atalhosHome ?? sanitized);
        this.clearLocal(userId);
      },
      error: () => {
        this.migratedUserIds.delete(userId);
      },
    });
  }

  private loadLocalIds(userId: string): string[] | null {
    try {
      const raw = localStorage.getItem(`${this.storagePrefix}${userId}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return null;
      return parsed.filter((x): x is string => typeof x === 'string');
    } catch {
      return null;
    }
  }

  private clearLocal(userId: string): void {
    try {
      localStorage.removeItem(`${this.storagePrefix}${userId}`);
    } catch {
      /* ignore */
    }
  }

  private canAccess(shortcut: HomeShortcutDef): boolean {
    if (shortcut.requiredPermissions.length === 0) return true;
    return this.auth.hasAnyPermission(shortcut.requiredPermissions);
  }
}
