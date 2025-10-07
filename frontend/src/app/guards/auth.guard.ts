import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Verificar se está autenticado localmente
  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  // Verificar se o token ainda é válido no servidor
  const isTokenValid = await authService.validateToken();
  
  if (!isTokenValid) {
    router.navigate(['/login']);
    return false;
  }

  return true;
};