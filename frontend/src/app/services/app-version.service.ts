import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AppVersionInfo {
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

  /** Recarrega a página para obter a versão publicada. */
  applyUpdate(): void {
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
      const data = (await response.json()) as AppVersionInfo;
      if (!data?.buildId || typeof data.buildId !== 'string') {
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }
}
