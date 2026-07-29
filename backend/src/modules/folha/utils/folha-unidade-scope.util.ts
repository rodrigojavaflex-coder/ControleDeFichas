import { ForbiddenException } from '@nestjs/common';
import { Unidade } from '../../../common/enums/unidade.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';

export type ListaFechamentoEscopo = Unidade | 'ALL';

/**
 * Unidade de cadastro do usuário para filtro de produtividade (não usa vendedor).
 */
export function unidadeCadastroUsuarioProducao(
  usuario: Usuario,
): Unidade | undefined {
  const u = usuario.unidade;
  if (u === undefined || u === null || String(u).trim() === '') {
    return undefined;
  }
  return u;
}

/**
 * Unidades cujo **resumo importado** e config remunerada entram na consulta.
 * Sem `usuario.unidade`: indefinido (escopo vem da query).
 * Com unidade, sem `unidades_produtividade`: só a unidade do usuário.
 * Com unidade e produção: unidade do usuário + unidades de produção (únicas).
 */
export function unidadesResumoProdutividade(
  usuario: Usuario,
): Unidade[] | undefined {
  const u = unidadeCadastroUsuarioProducao(usuario);
  if (!u) {
    return undefined;
  }

  const extras = (usuario.unidadesProdutividade ?? []).filter(
    Boolean,
  ) as Unidade[];
  if (extras.length === 0) {
    return [u];
  }

  const set = new Set<Unidade>([u]);
  for (const item of extras) {
    set.add(item);
  }
  return [...set];
}

/**
 * @deprecated Preferir `unidadesResumoProdutividade`.
 */
export function unidadesPermitidasProdutividade(
  usuario: Usuario,
): Unidade[] | undefined {
  return unidadesResumoProdutividade(usuario);
}

/**
 * Valida unidade informada na query de produtividade.
 * Usuário com cadastro: só aceita a própria unidade no filtro.
 */
export function assertUnidadeFiltroProdutividade(
  usuario: Usuario,
  unidade: Unidade,
): void {
  const cadastro = unidadeCadastroUsuarioProducao(usuario);
  if (!cadastro) {
    return;
  }
  if (cadastro !== unidade) {
    throw new ForbiddenException(
      'Filtro de unidade deve ser a unidade do usuário logado.',
    );
  }
}

/**
 * Resumo inclui unidades além do cadastro de funcionários (ex.: produção em NERÓPOLIS,
 * cadastro só INHUMAS): linhas dessas unidades creditam no funcionário local pelo `cdusu`.
 */
export function creditarProducaoResumoUnidadesExtras(
  unidadesResumo: Unidade[],
  unidadesFuncionarios: Unidade[],
): boolean {
  if (unidadesFuncionarios.length === 0 || unidadesResumo.length === 0) {
    return false;
  }
  const cadastro = new Set(unidadesFuncionarios);
  return unidadesResumo.some((u) => !cadastro.has(u));
}

/** Produtividade: valida unidade contra escopo de resumo do usuário. */
export function assertUnidadeProducao(
  usuario: Usuario,
  unidade: Unidade,
): void {
  const permitidas = unidadesResumoProdutividade(usuario);
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
export function unidadeEscopoUsuarioFolha(
  usuario: Usuario,
): Unidade | undefined {
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
