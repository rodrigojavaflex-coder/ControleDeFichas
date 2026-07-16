import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subscription, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ImportacaoManualProgress } from '../models/importacao-manual-progress.model';

@Injectable({
  providedIn: 'root',
})
export class ImportacaoManualProgressService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/importacao-manual`;

  getProgresso(): Observable<ImportacaoManualProgress | null> {
    return this.http.get<ImportacaoManualProgress | null>(
      `${this.apiUrl}/progresso`,
    );
  }

  iniciarPolling(
    onProgress: (progress: ImportacaoManualProgress | null) => void,
    intervalMs = 500,
  ): Subscription {
    return interval(intervalMs)
      .pipe(switchMap(() => this.getProgresso()))
      .subscribe({
        next: onProgress,
        error: () => {
          // Ignorar falhas pontuais de polling
        },
      });
  }
}
