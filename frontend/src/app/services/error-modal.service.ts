import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { normalizarMensagemErroApi } from '../utils/mensagem-erro-api.util';

export interface ErrorModalShowOptions {
  retryLabel?: string;
  onRetry?: () => void;
}

export interface ErrorModalState {
  visible: boolean;
  title?: string;
  message: string;
  retryLabel?: string;
}

@Injectable({ providedIn: 'root' })
export class ErrorModalService {
  private stateSubject = new BehaviorSubject<ErrorModalState>({ visible: false, message: '' });
  state$: Observable<ErrorModalState> = this.stateSubject.asObservable();
  private retryCallback: (() => void) | null = null;

  show(message: string, title?: string, options?: ErrorModalShowOptions): void {
    const texto = (message || '').replace(/<br\s*\/?>/gi, '\n');
    const formattedMessage = normalizarMensagemErroApi(texto);
    this.retryCallback = options?.onRetry ?? null;
    this.stateSubject.next({
      visible: true,
      title,
      message: formattedMessage,
      retryLabel: options?.retryLabel,
    });
  }

  retry(): void {
    const callback = this.retryCallback;
    this.hide();
    callback?.();
  }

  hide(): void {
    this.retryCallback = null;
    this.stateSubject.next({ visible: false, message: '' });
  }
}
