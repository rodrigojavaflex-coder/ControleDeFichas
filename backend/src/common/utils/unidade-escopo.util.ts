import { BadRequestException } from '@nestjs/common';
import { Unidade } from '../enums/unidade.enum';
import { Usuario } from '../../modules/usuarios/entities/usuario.entity';

/** Unidade do cadastro do usuário, se preenchida. */
export function unidadeDoUsuario(usuario: Usuario): Unidade | null {
  const texto = usuario.unidade?.trim();
  if (!texto) return null;
  if ((Object.values(Unidade) as string[]).includes(texto)) {
    return texto as Unidade;
  }
  return null;
}

/**
 * Unidade efetiva para listagem/CRUD.
 * Com vínculo no usuário, força essa unidade.
 * Sem vínculo, usa a solicitada (null = todas na listagem).
 */
export function resolverUnidadeEscopo(
  usuario: Usuario,
  solicitada?: Unidade | string | null,
): Unidade | null {
  const propria = unidadeDoUsuario(usuario);
  const pedida =
    typeof solicitada === 'string' && solicitada.trim()
      ? (solicitada.trim() as Unidade)
      : null;
  if (pedida && !(Object.values(Unidade) as string[]).includes(pedida)) {
    throw new BadRequestException('Unidade inválida.');
  }
  if (propria) {
    if (pedida && pedida !== propria) {
      throw new BadRequestException('A unidade informada é diferente da do usuário.');
    }
    return propria;
  }
  return pedida;
}

/** Unidade obrigatória em create/update. */
export function exigirUnidadeEscopo(
  usuario: Usuario,
  solicitada?: Unidade | string | null,
): Unidade {
  const unidade = resolverUnidadeEscopo(usuario, solicitada);
  if (!unidade) {
    throw new BadRequestException('Informe a unidade.');
  }
  return unidade;
}

/** Unidade do visitador em campo (funcionário, senão usuário). */
export function unidadeDoVisitador(usuario: Usuario): Unidade | null {
  const doFuncionario = usuario.funcionario?.unidade?.trim();
  if (
    doFuncionario &&
    (Object.values(Unidade) as string[]).includes(doFuncionario)
  ) {
    return doFuncionario as Unidade;
  }
  return unidadeDoUsuario(usuario);
}
