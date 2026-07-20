import { ForbiddenException } from '@nestjs/common';
import { Unidade } from '../../../common/enums/unidade.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { usuarioTemAdminFull } from '../../../common/utils/usuario-permissoes.util';

export type ListaFechamentoEscopo = Unidade | 'ALL';

/**
 * Escopo de unidade única para **produtividade**: apenas `usuario.unidade`.
 * Não usa fallback de `vendedor.unidade` — usuário sem unidade no cadastro pode fechar várias unidades.
 */
export function unidadeEscopoUsuarioProducao(
  usuario: Usuario,
): Unidade | undefined {
  const u = usuario.unidade;
  if (u !== undefined && u !== null && String(u).trim() !== '') {
    return u;
  }
  return undefined;
}

/** Produtividade: admin ou sem `usuario.unidade` pode consultar qualquer unidade informada. */
export function assertUnidadeProducao(
  usuario: Usuario,
  unidade: Unidade,
): void {
  if (usuarioTemAdminFull(usuario)) {
    return;
  }
  const escopo = unidadeEscopoUsuarioProducao(usuario);
  if (!escopo) {
    return;
  }
  if (escopo !== unidade) {
    throw new ForbiddenException('Acesso negado para a unidade informada.');
  }
}

/**
 * Unidade de escopo para folha quando há vínculo único (`usuario.unidade`; se vazio, usa
 * `vendedor.unidade` quando existir). Ausência ⇒ escopo liberado conforme permissões/RN-007.
 */
export function unidadeEscopoUsuarioFolha(usuario: Usuario): Unidade | undefined {
  const u = usuario.unidade;
  if (u !== undefined && u !== null && String(u).trim() !== '') {
    return u;
  }
  const v = usuario.vendedor?.unidade;
  if (v !== undefined && v !== null && String(v).trim() !== '') {
    return v;
  }
  return undefined;
}

/**
 * Operações de folha: admin global pode qualquer unidade; usuário com vínculo só a própria;
 * usuário **sem** unidade pode operar em qualquer unidade (controle/global).
 */
export function assertUnidadeFolha(usuario: Usuario, unidade: Unidade): void {
  if (usuarioTemAdminFull(usuario)) {
    return;
  }
  const escopo = unidadeEscopoUsuarioFolha(usuario);
  if (!escopo) {
    return;
  }
  if (escopo !== unidade) {
    throw new ForbiddenException('Acesso negado para a unidade informada.');
  }
}

/**
 * Listagem/consultas de fechamento: admin pode filtrar por unidade na query ou ver todas (`ALL`);
 * usuário vínculo único sempre na própria; sem vínculo idem admin para propósitos de lista.
 */
export function resolverEscopoListaFechamentoPorUsuario(
  usuario: Usuario,
  unidadeQuery?: Unidade,
): ListaFechamentoEscopo {
  if (usuarioTemAdminFull(usuario)) {
    return unidadeQuery ?? 'ALL';
  }
  const v = unidadeEscopoUsuarioFolha(usuario);
  if (v) {
    if (unidadeQuery && unidadeQuery !== v) {
      throw new ForbiddenException('Acesso negado para a unidade informada.');
    }
    return v;
  }
  return unidadeQuery ?? 'ALL';
}

/** Admin global; sem vínculo de unidade pode qualquer uma; vínculo único apenas a própria. */
export function usuarioPodeGerenciarUnidade(
  usuario: Usuario,
  unidadeEntidade: Unidade,
): boolean {
  if (usuarioTemAdminFull(usuario)) {
    return true;
  }
  const escopo = unidadeEscopoUsuarioFolha(usuario);
  if (!escopo) {
    return true;
  }
  return escopo === unidadeEntidade;
}
