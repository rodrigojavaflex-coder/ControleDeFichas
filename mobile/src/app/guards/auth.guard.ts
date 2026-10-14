import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    const biometricEnabled = await authService.isBiometricEnabled();
    if (!biometricEnabled) {
      return true;
    }

    const unlocked = await authService.requireBiometricUnlock();
    if (unlocked) {
      return true;
    }

    await authService.lockSession();
    router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
    return false;
  }

  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};
