import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable, map, catchError, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { APP_VERSION } from '../constants/app-version';
import { compareSemver, isValidSemver } from '../utils/semver.util';
import { AppUpdateRequiredService } from './app-update-required.service';

export interface MobileVersaoMinimaResponse {
  versaoMinima: string | null;
  bloqueioAtivo: boolean;
}

@Injectable({ providedIn: 'root' })
export class MobileVersionCheckService {
  private readonly http = inject(HttpClient);
  private readonly updateRequired = inject(AppUpdateRequiredService);

  private get apiBaseUrl(): string {
    return Capacitor.isNativePlatform()
      ? environment.apiUrlNative || environment.apiUrl
      : environment.apiUrl;
  }

  /**
   * Consulta a versão mínima no servidor e, se o app estiver abaixo, ativa o overlay.
   */
  checkAgainstServer(): Observable<boolean> {
    return this.http
      .get<MobileVersaoMinimaResponse>(
        `${this.apiBaseUrl}/configuracao/mobile-versao-minima`,
      )
      .pipe(
        map((res) => {
          const minima = res.versaoMinima?.trim() || null;
          if (
            !res.bloqueioAtivo ||
            !minima ||
            !isValidSemver(minima) ||
            compareSemver(APP_VERSION, minima) >= 0
          ) {
            return false;
          }
          this.updateRequired.show({
            versaoMinima: minima,
            versaoApp: APP_VERSION,
          });
          return true;
        }),
        catchError(() => of(false)),
      );
  }
}
