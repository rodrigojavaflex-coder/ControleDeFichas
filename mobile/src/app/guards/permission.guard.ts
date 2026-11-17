import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** OR: basta uma das permissões em `route.data.permissions`. */
export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const required = route.data?.['permissions'] as string[] | undefined;
  if (!required || required.length === 0) {
    return true;
  }
  if (auth.hasAnyPermission(required)) {
    return true;
  }
  return router.createUrlTree(['/home']);
};
