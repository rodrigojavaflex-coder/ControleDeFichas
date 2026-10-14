import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError, from } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Não interceptar requisições de login/refresh
  if (req.url.includes('/auth/login') || req.url.includes('/auth/refresh')) {
    return next(req);
  }

  return from(authService.getAccessToken()).pipe(
    switchMap(token => {
      if (token) {
        req = req.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        });
      }

      return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            // Token expirado, tentar refresh
            return from(authService.refreshAccessToken()).pipe(
              switchMap(newToken => {
                if (newToken) {
                  // Retentar requisição com novo token
                  const newReq = req.clone({
                    setHeaders: {
                      Authorization: `Bearer ${newToken}`
                    }
                  });
                  return next(newReq);
                } else {
                  // Refresh falhou, fazer logout
                  authService.logout();
                  return throwError(() => error);
                }
              }),
              catchError(() => {
                  authService.logout();
                  return throwError(() => error);
              })
            );
          }
          return throwError(() => error);
        })
      );
    })
  );
};
