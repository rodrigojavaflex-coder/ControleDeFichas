import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface GlobalBlockingOverlayState {
  active: boolean;
  title: string;
  message: string;
  note: string;
  progressCurrent: number;
  progressTotal: number;
  progressLabel: string;
}

const INITIAL: GlobalBlockingOverlayState = {
  active: false,
  title: '',
  message: '',
  note: '',
  progressCurrent: 0,
  progressTotal: 0,
  progressLabel: '',
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
      title: partial.title,
      message: partial.message ?? '',
      note: partial.note ?? '',
      progressCurrent: partial.progressCurrent ?? 0,
      progressTotal: partial.progressTotal ?? 0,
      progressLabel: partial.progressLabel ?? '',
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

  hide(): void {
    this.stateSubject.next({ ...INITIAL });
    document.body.classList.remove('global-blocking-active');
  }
}
