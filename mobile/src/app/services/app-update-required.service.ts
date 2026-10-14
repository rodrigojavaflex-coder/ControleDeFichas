import { Injectable, computed, signal } from '@angular/core';
import { APP_VERSION } from '../constants/app-version';

export interface AppUpdateRequiredState {
  required: boolean;
  message: string;
  versaoMinima: string | null;
  versaoApp: string;
}

const DEFAULT_MESSAGE = 'Atualize o aplicativo para continuar.';

@Injectable({ providedIn: 'root' })
export class AppUpdateRequiredService {
  private readonly state = signal<AppUpdateRequiredState>({
    required: false,
    message: DEFAULT_MESSAGE,
    versaoMinima: null,
    versaoApp: APP_VERSION,
  });

  readonly required = computed(() => this.state().required);
  readonly message = computed(() => this.state().message);
  readonly versaoMinima = computed(() => this.state().versaoMinima);
  readonly versaoApp = computed(() => this.state().versaoApp);

  show(params?: {
    message?: string;
    versaoMinima?: string | null;
    versaoApp?: string;
  }): void {
    this.state.set({
      required: true,
      message: params?.message?.trim() || DEFAULT_MESSAGE,
      versaoMinima: params?.versaoMinima?.trim() || null,
      versaoApp: params?.versaoApp?.trim() || APP_VERSION,
    });
  }

  clear(): void {
    this.state.set({
      required: false,
      message: DEFAULT_MESSAGE,
      versaoMinima: null,
      versaoApp: APP_VERSION,
    });
  }
}
