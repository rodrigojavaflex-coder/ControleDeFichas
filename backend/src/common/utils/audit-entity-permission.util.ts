import { ForbiddenException } from '@nestjs/common';
import { Permission } from '../enums/permission.enum';
import { Usuario } from '../../modules/usuarios/entities/usuario.entity';
import { getUsuarioPermissoes } from './usuario-permissoes.util';

/** Permissões aceitas (OR) para consultar histórico por entidade auditada. */
const PERMISSOES_HISTORICO_POR_ENTIDADE: Record<string, Permission[]> = {
  usuarios: [Permission.USER_AUDIT],
  vendas: [Permission.VENDA_AUDIT],
  clientes: [Permission.CLIENTE_AUDIT],
  vendedores: [Permission.VENDEDOR_AUDIT],
  prescritores: [Permission.PRESCRITOR_AUDIT],
  fichas_tecnicas: [Permission.FICHA_TECNICA_AUDIT],
  certificados: [Permission.CERTIFICADO_AUDIT],
  folha_cargo: [Permission.FOLHA_CARGO_AUDIT],
  folha_setor: [Permission.FOLHA_SETOR_AUDIT],
  folha_verba: [Permission.FOLHA_VERBA_AUDIT],
  folha_item: [Permission.FOLHA_LANCAMENTO_READ, Permission.AUDIT_VIEW],
};

export function assertPermissaoHistoricoEntidade(
  usuario: Usuario,
  entidade: string,
): void {
  const chave = entidade.trim().toLowerCase();
  const aceitas = PERMISSOES_HISTORICO_POR_ENTIDADE[chave];
  if (!aceitas?.length) {
    throw new ForbiddenException(
      'Consulta de histórico não permitida para esta entidade.',
    );
  }

  const permissoes = getUsuarioPermissoes(usuario);
  const autorizado = aceitas.some((p) => permissoes.includes(p));
  if (!autorizado) {
    throw new ForbiddenException(
      'Acesso negado ao histórico de alterações deste registro.',
    );
  }
}
