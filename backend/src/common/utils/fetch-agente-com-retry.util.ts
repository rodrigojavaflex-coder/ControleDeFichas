import { Logger } from '@nestjs/common';
import {
  formatarErroRespostaAgente,
  isRespostaErroConexaoAgente,
  mensagemErroChamadaAgente,
  MENSAGEM_ERRO_CONEXAO_AGENTE,
} from './formatar-erro-agente.util';

/** Intervalo entre tentativas quando o agente rejeita rápido (offline/túnel). */
export const AGENTE_RETRY_BACKOFF_MS = [5000, 10000];
/** Caixa: operação manual com overlay — aguarda mais entre tentativas. */
export const AGENTE_RETRY_BACKOFF_CAIXA_MS = [10000, 20000];

const DEFAULT_BACKOFF_MS = AGENTE_RETRY_BACKOFF_MS;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_MAX_FAIL_FAST_MS = 15_000;

export interface FetchAgenteComRetryOptions {
  timeoutMs: number;
  maxAttempts?: number;
  backoffMs?: number[];
  maxFailFastMs?: number;
  logger?: Logger;
  rotulo?: string;
}

class AgenteFetchFatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgenteFetchFatalError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function podeRetentarAgente(
  elapsedMs: number,
  attempt: number,
  maxAttempts: number,
  maxFailFastMs: number,
  status?: number,
  corpo?: string | null,
  error?: unknown,
): boolean {
  if (attempt >= maxAttempts) {
    return false;
  }
  if (elapsedMs > maxFailFastMs) {
    return false;
  }
  if (status != null) {
    return isRespostaErroConexaoAgente(status, corpo);
  }
  return mensagemErroChamadaAgente(error) === MENSAGEM_ERRO_CONEXAO_AGENTE;
}

export async function fetchAgenteComRetry(
  url: string,
  init: RequestInit,
  options: FetchAgenteComRetryOptions,
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const maxFailFastMs = options.maxFailFastMs ?? DEFAULT_MAX_FAIL_FAST_MS;

  let lastError = new Error(MENSAGEM_ERRO_CONEXAO_AGENTE);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
    const inicio = Date.now();

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const elapsed = Date.now() - inicio;

      if (response.ok) {
        if (attempt > 1 && options.logger) {
          options.logger.log(
            `Agente ${options.rotulo ?? url} respondeu na tentativa ${attempt}/${maxAttempts} (${elapsed}ms)`,
          );
        }
        return response;
      }

      const errorText = await response.text().catch(() => 'Erro desconhecido');
      const message = formatarErroRespostaAgente(response.status, errorText);
      lastError = new Error(message);

      if (
        !podeRetentarAgente(
          elapsed,
          attempt,
          maxAttempts,
          maxFailFastMs,
          response.status,
          errorText,
        )
      ) {
        throw new AgenteFetchFatalError(message);
      }

      options.logger?.warn(
        `Agente ${options.rotulo ?? ''} HTTP ${response.status} (resposta em ${elapsed}ms) — tentativa ${attempt}/${maxAttempts}; aguardando ${backoffMs[attempt - 1] ?? 5000}ms antes da próxima`,
      );
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof AgenteFetchFatalError) {
        throw error;
      }

      const elapsed = Date.now() - inicio;
      lastError = new Error(mensagemErroChamadaAgente(error));

      if (
        !podeRetentarAgente(
          elapsed,
          attempt,
          maxAttempts,
          maxFailFastMs,
          undefined,
          null,
          error,
        )
      ) {
        throw lastError;
      }

      options.logger?.warn(
        `Agente ${options.rotulo ?? ''} indisponível (resposta em ${elapsed}ms) — tentativa ${attempt}/${maxAttempts}; aguardando ${backoffMs[attempt - 1] ?? 5000}ms antes da próxima`,
      );
    }

    if (attempt < maxAttempts) {
      await sleep(backoffMs[attempt - 1] ?? backoffMs[backoffMs.length - 1] ?? 5000);
    }
  }

  throw lastError;
}
