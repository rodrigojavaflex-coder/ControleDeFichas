import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { APP_VERSION } from '../constants/app-version';
import { AppUpdateRequiredService } from '../services/app-update-required.service';

const APP_VERSION_REQUIRED_CODE = 'APP_VERSION_REQUIRED';

function isAppVersionRequiredError(error: HttpErrorResponse): boolean {
  if (error.status !== 426) {
    return false;
  }
  const body = error.error as {
    code?: string;
    message?: string;
    versaoMinima?: string;
    versaoApp?: string;
  } | null;
  return body?.code === APP_VERSION_REQUIRED_CODE || error.status === 426;
}

/**
 * Envia X-App-Version em todas as requests e trata bloqueio por versão mínima.
 */
export const appVersionInterceptor: HttpInterceptorFn = (req, next) => {
  const updateRequired = inject(AppUpdateRequiredService);
  const withVersion = req.clone({
    setHeaders: {
      'X-App-Version': APP_VERSION,
    },
  });

  return next(withVersion).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isAppVersionRequiredError(error)) {
        const body = error.error as {
          message?: string;
          versaoMinima?: string;
          versaoApp?: string;
        } | null;
        updateRequired.show({
          message: body?.message,
          versaoMinima: body?.versaoMinima ?? null,
          versaoApp: body?.versaoApp ?? APP_VERSION,
        });
      }
      return throwError(() => error);
    }),
  );
};
