import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Permission } from '../models/usuario.model';

/**
 * Bloqueia navegação direta por URL quando o usuário não tem permissão.
 * Use junto com `authGuard` e declare `data.permissions` na rota (OR).
 *
 * Exemplo:
 * ```ts
 * {
 *   path: 'relatorios/fechamento-caixa',
 *   canActivate: [authGuard, permissionGuard],
 *   data: { permissions: [Permission.VENDA_FECHAR_CAIXA] },
 * }
 * ```
 */
export const permissionGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const required = route.data?.['permissions'] as Permission[] | undefined;

  // Sem lista = qualquer autenticado (authGuard já validou login/token).
  if (!required?.length) {
    return true;
  }

  if (authService.hasAnyPermission(required)) {
    return true;
  }

  void router.navigate(['/']);
  return false;
};
