import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface ErrorModalState {
  visible: boolean;
  title?: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ErrorModalService {
  private stateSubject = new BehaviorSubject<ErrorModalState>({ visible: false, message: '' });
  state$: Observable<ErrorModalState> = this.stateSubject.asObservable();

  show(message: string, title?: string): void {
    const formattedMessage = (message || '').replace(/\n/g, '<br>');
    this.stateSubject.next({ visible: true, title, message: formattedMessage });
  }

  hide(): void {
    this.stateSubject.next({ visible: false, message: '' });
  }
}
