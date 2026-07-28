import type { Request } from 'express';
import type { Usuario } from '../../modules/usuarios/entities/usuario.entity';

/** Request HTTP com usuário JWT (Passport) e metadados usados pelo interceptor de auditoria. */
export type AppRequest = Request & {
  user?: Usuario;
  previousUserData?: unknown;
  entityToDelete?: unknown;
};
