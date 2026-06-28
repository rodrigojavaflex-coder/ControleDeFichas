import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface GlobalBlockingOverlayState {
  active: boolean;
  phase: 'processing' | 'done';
  title: string;
  message: string;
  note: string;
  progressCurrent: number;
  progressTotal: number;
  progressLabel: string;
  dismissButtonLabel: string;
}

const INITIAL: GlobalBlockingOverlayState = {
  active: false,
  phase: 'processing',
  title: '',
  message: '',
  note: '',
  progressCurrent: 0,
  progressTotal: 0,
  progressLabel: '',
  dismissButtonLabel: '',
};

@Injectable({ providedIn: 'root' })
export class GlobalBlockingOverlayService {
  private readonly stateSubject = new BehaviorSubject<GlobalBlockingOverlayState>({
    ...INITIAL,
  });

  readonly state$ = this.stateSubject.asObservable();

  show(partial: {
    title: string;
    message?: string;
    note?: string;
    progressCurrent?: number;
    progressTotal?: number;
    progressLabel?: string;
  }): void {
    const prev = this.stateSubject.value;
    this.stateSubject.next({
      active: true,
      phase: 'processing',
      title: partial.title,
      message: partial.message ?? '',
      note: partial.note ?? '',
      progressCurrent: partial.progressCurrent ?? 0,
      progressTotal: partial.progressTotal ?? 0,
      progressLabel: partial.progressLabel ?? '',
      dismissButtonLabel: '',
    });
    if (!prev.active) {
      document.body.classList.add('global-blocking-active');
    }
  }

  updateProgress(current: number, total: number, progressLabel?: string): void {
    const prev = this.stateSubject.value;
    if (!prev.active) return;
    this.stateSubject.next({
      ...prev,
      progressCurrent: current,
      progressTotal: total,
      progressLabel: progressLabel ?? prev.progressLabel,
    });
  }

  complete(partial: {
    title?: string;
    message: string;
    note?: string;
    dismissButtonLabel?: string;
  }): void {
    const prev = this.stateSubject.value;
    this.stateSubject.next({
      ...prev,
      active: true,
      phase: 'done',
      title: partial.title ?? prev.title,
      message: partial.message,
      note: partial.note ?? '',
      progressCurrent: 0,
      progressTotal: 0,
      progressLabel: '',
      dismissButtonLabel: partial.dismissButtonLabel ?? 'Concluir atualização',
    });
    if (!document.body.classList.contains('global-blocking-active')) {
      document.body.classList.add('global-blocking-active');
    }
  }

  hide(): void {
    this.stateSubject.next({ ...INITIAL });
    document.body.classList.remove('global-blocking-active');
  }
}
