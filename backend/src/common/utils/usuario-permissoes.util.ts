import { Permission } from '../enums/permission.enum';
import { Usuario } from '../../modules/usuarios/entities/usuario.entity';

/** União das permissões de todos os perfis vinculados ao usuário (RN: múltiplos perfis). */
export function getUsuarioPermissoes(usuario: Usuario): Permission[] {
  return Array.from(
    new Set(
      (usuario.perfis || [])
        .flatMap((perfil) => perfil.permissoes || [])
        .filter(Boolean),
    ),
  );
}

export function usuarioTemAdminFull(usuario: Usuario): boolean {
  return getUsuarioPermissoes(usuario).includes(Permission.ADMIN_FULL);
}
