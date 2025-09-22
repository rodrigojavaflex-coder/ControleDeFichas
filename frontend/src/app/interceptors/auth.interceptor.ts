import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, switchMap, from } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Não adicionar token para requisições de login
  const isAuthUrl = req.url.includes('/auth/login') || req.url.includes('/auth/refresh');
  
  if (isAuthUrl) {
    return next(req);
  }

  // Adicionar token se disponível
  const token = authService.getAccessToken();
  
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Se token expirou (401), tentar refresh
      if (error.status === 401 && token && !req.url.includes('/auth/refresh')) {
        return from(authService.refreshToken()).pipe(
          switchMap(newToken => {
            if (newToken) {
              // Repetir requisição com novo token
              const newReq = req.clone({
                setHeaders: {
                  Authorization: `Bearer ${newToken}`
                }
              });
              return next(newReq);
            } else {
              // Refresh falhou, redirecionar para login
              router.navigate(['/login']);
              return throwError(() => error);
            }
          }),
          catchError(() => {
            router.navigate(['/login']);
            return throwError(() => error);
          })
        );
      }

      // Outros erros, apenas repassar
      return throwError(() => error);
    })
  );
};