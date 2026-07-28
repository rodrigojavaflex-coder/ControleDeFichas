import type { CreateConfiguracaoDto } from '../dto/create-configuracao.dto';
import type { UpdateConfiguracaoDto } from '../dto/update-configuracao.dto';

function parseBoolField(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint'
  ) {
    return String(value) === 'true';
  }
  return defaultValue;
}

function strField(
  body: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = body[key];
  if (v === undefined || v === null) {
    return undefined;
  }
  if (typeof v === 'string') {
    return v;
  }
  if (
    typeof v === 'number' ||
    typeof v === 'bigint' ||
    typeof v === 'boolean'
  ) {
    return String(v);
  }
  return undefined;
}

export function parseCreateConfiguracaoBody(
  body: Record<string, unknown>,
): CreateConfiguracaoDto {
  return {
    nomeCliente: strField(body, 'nomeCliente'),
    farmaceuticoResponsavel: strField(body, 'farmaceuticoResponsavel'),
    auditarConsultas: parseBoolField(body.auditarConsultas, true),
    auditarLoginLogOff: parseBoolField(body.auditarLoginLogOff, true),
    auditarCriacao: parseBoolField(body.auditarCriacao, true),
    auditarAlteracao: parseBoolField(body.auditarAlteracao, true),
    auditarExclusao: parseBoolField(body.auditarExclusao, true),
    auditarSenhaAlterada: parseBoolField(body.auditarSenhaAlterada, true),
  };
}

export function parseUpdateConfiguracaoBody(
  body: Record<string, unknown>,
): UpdateConfiguracaoDto {
  const dto: UpdateConfiguracaoDto = {
    nomeCliente: strField(body, 'nomeCliente'),
    farmaceuticoResponsavel: strField(body, 'farmaceuticoResponsavel'),
  };
  if (body.auditarConsultas !== undefined) {
    dto.auditarConsultas = parseBoolField(body.auditarConsultas, true);
  }
  if (body.auditarLoginLogOff !== undefined) {
    dto.auditarLoginLogOff = parseBoolField(body.auditarLoginLogOff, true);
  }
  if (body.auditarCriacao !== undefined) {
    dto.auditarCriacao = parseBoolField(body.auditarCriacao, true);
  }
  if (body.auditarAlteracao !== undefined) {
    dto.auditarAlteracao = parseBoolField(body.auditarAlteracao, true);
  }
  if (body.auditarExclusao !== undefined) {
    dto.auditarExclusao = parseBoolField(body.auditarExclusao, true);
  }
  if (body.auditarSenhaAlterada !== undefined) {
    dto.auditarSenhaAlterada = parseBoolField(body.auditarSenhaAlterada, true);
  }
  return dto;
}
