/** Mensagem exibida quando o agente/túnel da unidade está indisponível. */
export const MENSAGEM_ERRO_CONEXAO_AGENTE =
  'Busca das informações está indisponível\n' +
  'Não foi possível conectar ao Servidor da unidade.\n' +
  'Aguarde alguns minutos e tente de novo.';

function extrairTextoMensagemErro(err: unknown): string | null {
  if (!err || typeof err !== 'object') {
    return null;
  }
  const body = (err as { error?: unknown }).error;
  if (!body) {
    return null;
  }
  if (typeof body === 'string') {
    return body;
  }
  if (typeof body === 'object' && body !== null && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.filter((m) => typeof m === 'string').join(', ');
    }
  }
  return null;
}

export function isMensagemErroConexaoAgente(mensagem: string | null | undefined): boolean {
  if (!mensagem?.trim()) {
    return false;
  }
  if (mensagem.trim() === MENSAGEM_ERRO_CONEXAO_AGENTE) {
    return true;
  }
  const texto = mensagem.trim();
  if (texto.length > 400) {
    return true;
  }
  if (/^<!doctype|^<html[\s>]/i.test(texto)) {
    return true;
  }
  if (/cloudflare tunnel error|error code:\s*1033/i.test(texto)) {
    return true;
  }
  if (
    /Erro ao (consultar|buscar)[\s\S]*agente[\s\S]*\(\s*(502|503|504|530)\s*\)/i.test(
      texto,
    )
  ) {
    return true;
  }
  if (
    /Erro ao (consultar|buscar)[\s\S]*do agente:\s*(502|503|504|530)\s*-/i.test(
      texto,
    )
  ) {
    return true;
  }
  if (/:\s*(502|503|504|530)\s*-\s*<!doctype/i.test(texto)) {
    return true;
  }
  if (texto.includes(MENSAGEM_ERRO_CONEXAO_AGENTE.split('\n')[0])) {
    return true;
  }
  if (/Timeout ao consultar agente/i.test(texto)) {
    return true;
  }
  return false;
}

export function normalizarMensagemErroApi(
  mensagem: string | null | undefined,
): string {
  if (isMensagemErroConexaoAgente(mensagem)) {
    return MENSAGEM_ERRO_CONEXAO_AGENTE;
  }
  return mensagem?.trim() ?? '';
}

export function extrairMensagemErroApi(
  err: unknown,
  fallback = 'Não foi possível concluir a operação. Tente novamente.',
): string {
  const bruta =
    extrairTextoMensagemErro(err) ??
    (err instanceof Error ? err.message : null);
  const normalizada = normalizarMensagemErroApi(bruta);
  return normalizada || fallback;
}

/** Normaliza e deduplica erros de sync/importação exibidos em listas. */
export function normalizarListaErrosAgente(erros: string[]): string[] {
  const saida: string[] = [];
  let conexaoRegistrada = false;
  const tituloConexao = MENSAGEM_ERRO_CONEXAO_AGENTE.split('\n')[0];

  for (const erro of erros) {
    const msg = normalizarMensagemErroApi(erro);
    if (!msg) {
      continue;
    }
    if (msg === MENSAGEM_ERRO_CONEXAO_AGENTE || msg.includes(tituloConexao)) {
      if (!conexaoRegistrada) {
        saida.push(MENSAGEM_ERRO_CONEXAO_AGENTE);
        conexaoRegistrada = true;
      }
      continue;
    }
    if (!saida.includes(msg)) {
      saida.push(msg);
    }
  }

  return saida;
}
