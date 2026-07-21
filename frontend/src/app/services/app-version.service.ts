import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AppVersionInfo {
  version: string;
  buildId: string;
  generatedAt?: string;
}

/**
 * Detecta deploy novo enquanto a aba permanece aberta.
 * Compara o buildId carregado no boot com /version.json (sem cache).
 * Ativo apenas em production.
 */
@Injectable({ providedIn: 'root' })
export class AppVersionService {
  private readonly checkIntervalMs = 5 * 60 * 1000;
  private localBuildId: string | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private started = false;

  private readonly updateAvailableSubject = new BehaviorSubject<boolean>(false);
  readonly updateAvailable$: Observable<boolean> =
    this.updateAvailableSubject.asObservable();

  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'visible') {
      void this.checkForUpdate();
    }
  };

  /** Inicia monitoramento (idempotente). No-op em development. */
  async start(): Promise<void> {
    if (this.started || !environment.production) {
      return;
    }
    this.started = true;

    const info = await this.fetchVersion();
    if (!info?.buildId) {
      return;
    }
    this.localBuildId = info.buildId;

    this.intervalId = setInterval(() => {
      void this.checkForUpdate();
    }, this.checkIntervalMs);

    document.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Obtém a versão publicada atual (sem cache HTTP). */
  async getCurrentVersion(): Promise<AppVersionInfo | null> {
    return this.fetchVersion();
  }

  formatVersionLabel(info: AppVersionInfo | null): string {
    if (!info) {
      return '';
    }
    return info.version?.trim() || '0.0.0';
  }

  formatVersionDateLabel(info: AppVersionInfo | null): string {
    if (!info?.generatedAt) {
      return '';
    }
    const match = info.generatedAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) {
      return '';
    }
    const [, year, month, day] = match;
    return `${day}/${month}/${year}`;
  }

  formatBuildLabel(info: AppVersionInfo | null): string {
    if (!info?.buildId) {
      return '';
    }
    return info.buildId.split('-')[0];
  }

  /** Recarrega a página para obter a versão publicada. */
  applyUpdate(): void {
    void this.forceReload();
  }

  /** Força busca da versão remota e recarrega a aplicação (mantém sessão). */
  async forceReload(): Promise<void> {
    try {
      await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
    } catch {
      // Recarrega mesmo se version.json estiver indisponível (ex.: dev local).
    }
    window.location.reload();
  }

  private async checkForUpdate(): Promise<void> {
    if (!this.localBuildId) {
      return;
    }
    const remote = await this.fetchVersion();
    if (!remote?.buildId) {
      return;
    }
    if (remote.buildId !== this.localBuildId) {
      this.updateAvailableSubject.next(true);
    }
  }

  private async fetchVersion(): Promise<AppVersionInfo | null> {
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) {
        return null;
      }
      const data = (await response.json()) as Partial<AppVersionInfo>;
      if (!data?.buildId || typeof data.buildId !== 'string') {
        return null;
      }
      return {
        version:
          typeof data.version === 'string' && data.version.trim()
            ? data.version.trim()
            : '0.0.0',
        buildId: data.buildId,
        generatedAt: data.generatedAt,
      };
    } catch {
      return null;
    }
  }
}
