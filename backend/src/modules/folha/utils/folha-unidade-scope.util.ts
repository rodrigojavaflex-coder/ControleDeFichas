import { ForbiddenException } from '@nestjs/common';
import { Unidade } from '../../../common/enums/unidade.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';

export type ListaFechamentoEscopo = Unidade | 'ALL';

/**
 * Unidades que o usuário pode consultar na **produtividade**.
 * `undefined` = sem `usuario.unidade` (escopo global conforme permissões).
 * Não usa fallback de `vendedor.unidade`.
 */
export function unidadesPermitidasProdutividade(
  usuario: Usuario,
): Unidade[] | undefined {
  const u = usuario.unidade;
  const hasUnidade =
    u !== undefined && u !== null && String(u).trim() !== '';
  if (!hasUnidade) {
    return undefined;
  }

  const extras = (usuario.unidadesProdutividade ?? []).filter(Boolean);
  const unicas = [...new Set(extras)] as Unidade[];
  if (unicas.length === 0) {
    return [u as Unidade];
  }
  return unicas;
}

/**
 * @deprecated Preferir `unidadesPermitidasProdutividade`. Retorna unidade única quando o escopo tem exatamente uma.
 */
export function unidadeEscopoUsuarioProducao(
  usuario: Usuario,
): Unidade | undefined {
  const permitidas = unidadesPermitidasProdutividade(usuario);
  if (!permitidas || permitidas.length !== 1) {
    return undefined;
  }
  return permitidas[0];
}

/** Produtividade: valida unidade contra `unidadesPermitidasProdutividade`. */
export function assertUnidadeProducao(
  usuario: Usuario,
  unidade: Unidade,
): void {
  const permitidas = unidadesPermitidasProdutividade(usuario);
  if (!permitidas) {
    return;
  }
  if (!permitidas.includes(unidade)) {
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
 * Operações de folha: usuário com vínculo só a própria unidade;
 * usuário **sem** unidade pode operar em qualquer unidade (controle/global).
 */
export function assertUnidadeFolha(usuario: Usuario, unidade: Unidade): void {
  const escopo = unidadeEscopoUsuarioFolha(usuario);
  if (!escopo) {
    return;
  }
  if (escopo !== unidade) {
    throw new ForbiddenException('Acesso negado para a unidade informada.');
  }
}

/**
 * Listagem/consultas de fechamento: usuário sem vínculo pode filtrar por unidade na query ou ver todas (`ALL`);
 * usuário vínculo único sempre na própria.
 */
export function resolverEscopoListaFechamentoPorUsuario(
  usuario: Usuario,
  unidadeQuery?: Unidade,
): ListaFechamentoEscopo {
  const v = unidadeEscopoUsuarioFolha(usuario);
  if (v) {
    if (unidadeQuery && unidadeQuery !== v) {
      throw new ForbiddenException('Acesso negado para a unidade informada.');
    }
    return v;
  }
  return unidadeQuery ?? 'ALL';
}

/** Sem vínculo de unidade pode qualquer uma; vínculo único apenas a própria. */
export function usuarioPodeGerenciarUnidade(
  usuario: Usuario,
  unidadeEntidade: Unidade,
): boolean {
  const escopo = unidadeEscopoUsuarioFolha(usuario);
  if (!escopo) {
    return true;
  }
  return escopo === unidadeEntidade;
}
