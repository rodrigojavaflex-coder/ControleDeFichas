import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ErrorMessageService {
  fromApi(error: unknown, fallback: string): string {
    const anyError = error as any;
    const hasHttpStatus =
      anyError != null &&
      (Object.prototype.hasOwnProperty.call(anyError, 'status') ||
        Object.prototype.hasOwnProperty.call(anyError, 'statusCode'));
    const status = Number(anyError?.status ?? anyError?.statusCode ?? 0);

    if (hasHttpStatus && status === 0) {
      return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
    }

    const backendDetail = this.tryExtractBackendMessage(anyError);

    if (hasHttpStatus) {
      switch (status) {
        case 400:
        case 422:
          if (backendDetail) {
            return this.normalizePtBrMessage(backendDetail);
          }
          return status === 422
            ? 'Alguns dados informados são inválidos.'
            : 'Solicitação inválida. Revise os dados e tente novamente.';
        case 401:
          return 'E-mail ou senha inválidos.';
        case 403:
          return 'Você não tem permissão para executar esta ação.';
        case 404:
          return 'Recurso não encontrado.';
        case 408:
          return 'Tempo de conexão esgotado. Tente novamente.';
        case 409:
          return 'Conflito de dados. Atualize a tela e tente novamente.';
        case 429:
          return 'Muitas tentativas em sequência. Aguarde alguns instantes.';
        case 500:
        case 502:
        case 503:
        case 504:
          return 'Serviço temporariamente indisponível. Tente novamente em instantes.';
        default:
          break;
      }
    }

    if (!backendDetail) {
      return fallback;
    }

    const lowered = backendDetail.toLowerCase();
    if (
      lowered.includes('network error') ||
      lowered.includes('failed to fetch') ||
      lowered.includes('timeout') ||
      lowered.includes('timed out')
    ) {
      return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
    }

    return this.normalizePtBrMessage(backendDetail || fallback);
  }

  /** Extrai texto útil enviado pelo backend (Nest `message` pode ser string ou string[]). */
  private tryExtractBackendMessage(anyError: any): string | null {
    const raw = anyError?.error?.message ?? anyError?.message;
    if (raw === undefined || raw === null || raw === '') {
      return null;
    }

    const normalized = Array.isArray(raw) ? raw.join(' ') : String(raw);
    const sanitized = normalized
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/Http failure response for/gi, '')
      .replace(/Unknown Error/gi, '')
      .replace(/HttpErrorResponse/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    return sanitized || null;
  }

  private normalizePtBrMessage(message: string): string {
    return message
      .replace(/\b[Nn]ao\b/g, (value) => (value[0] === 'N' ? 'Não' : 'não'))
      .replace(/\b[Pp]ossivel\b/g, (value) =>
        value[0] === 'P' ? 'Possível' : 'possível',
      )
      .replace(/\b[Ss]ervico\b/g, (value) =>
        value[0] === 'S' ? 'Serviço' : 'serviço',
      )
      .replace(/\b[Ii]nvalidos\b/g, (value) =>
        value[0] === 'I' ? 'Inválidos' : 'inválidos',
      )
      .replace(/\b[Mm]idias\b/g, (value) =>
        value[0] === 'M' ? 'Mídias' : 'mídias',
      )
      .replace(/\b[Vv]eiculo\b/g, (value) =>
        value[0] === 'V' ? 'Veículo' : 'veículo',
      );
  }
}
