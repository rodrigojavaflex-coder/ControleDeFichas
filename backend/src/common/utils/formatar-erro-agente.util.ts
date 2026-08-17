import { getErrorMessage } from './error-message.util';

/** Mensagem exibida quando o agente/túnel da unidade está indisponível. */
export const MENSAGEM_ERRO_CONEXAO_AGENTE =
  'Busca das informações está indisponível\n' +
  'Não foi possível conectar ao Servidor da unidade.\n' +
  'Aguarde alguns minutos e tente de novo.';

const STATUS_CONEXAO_AGENTE = new Set([
  502, 503, 504, 520, 521, 522, 523, 524, 530,
]);

function extrairMensagemJsonAgente(corpo?: string | null): string | null {
  const texto = corpo?.trim();
  if (!texto?.startsWith('{')) {
    return null;
  }
  try {
    const json = JSON.parse(texto) as { message?: string | string[] };
    if (Array.isArray(json.message)) {
      return json.message.join('; ');
    }
    if (typeof json.message === 'string' && json.message.trim()) {
      return json.message.trim();
    }
  } catch {
    // corpo não é JSON válido
  }
  return null;
}

export function isRespostaErroConexaoAgente(
  status?: number,
  corpo?: string | null,
): boolean {
  if (status != null && STATUS_CONEXAO_AGENTE.has(status)) {
    return true;
  }
  const texto = corpo?.trim();
  if (!texto) {
    return false;
  }
  if (extrairMensagemJsonAgente(texto)) {
    return false;
  }
  if (texto.length > 400) {
    return true;
  }
  if (/^<!doctype|^<html[\s>]/i.test(texto)) {
    return true;
  }
  if (/cloudflare tunnel error|error code:\s*1033/i.test(texto)) {
    return true;
  }
  return false;
}

export function formatarErroRespostaAgente(
  status: number,
  corpo?: string | null,
): string {
  const msgJson = extrairMensagemJsonAgente(corpo);
  if (msgJson) {
    return `Erro ao consultar agente (${status}): ${msgJson}`;
  }
  if (isRespostaErroConexaoAgente(status, corpo)) {
    return MENSAGEM_ERRO_CONEXAO_AGENTE;
  }
  const resumo = corpo?.trim().slice(0, 200) || 'Erro desconhecido';
  return `Erro ao consultar agente (${status}): ${resumo}`;
}

export function mensagemErroChamadaAgente(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') {
    return MENSAGEM_ERRO_CONEXAO_AGENTE;
  }

  const msg = getErrorMessage(error);
  if (isRespostaErroConexaoAgente(undefined, msg)) {
    return MENSAGEM_ERRO_CONEXAO_AGENTE;
  }

  if (
    /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|network error|Failed to fetch/i.test(
      msg,
    )
  ) {
    return MENSAGEM_ERRO_CONEXAO_AGENTE;
  }

  if (
    /Erro ao (consultar|buscar)[\s\S]*agente[\s\S]*\(\s*(502|503|504|530)\s*\)/i.test(
      msg,
    )
  ) {
    return MENSAGEM_ERRO_CONEXAO_AGENTE;
  }

  if (
    /Erro ao (consultar|buscar)[\s\S]*do agente:\s*(502|503|504|530)\s*-/i.test(
      msg,
    )
  ) {
    return MENSAGEM_ERRO_CONEXAO_AGENTE;
  }

  return msg;
}
