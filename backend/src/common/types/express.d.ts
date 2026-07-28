import type { Usuario } from '../../modules/usuarios/entities/usuario.entity';

declare global {
  namespace Express {
    // Augmentação Passport: alias sem membros extras (no-empty-object-type).
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends Usuario {}
  }
}

export {};
