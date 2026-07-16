import {
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  IMPORTACAO_MANUAL_LOG_MAX,
  ImportacaoManualFase,
  ImportacaoManualLogEntry,
  ImportacaoManualProgress,
  ImportacaoManualStatus,
  ImportacaoManualTipo,
} from './importacao-manual-progress.types';

@Injectable()
export class ImportacaoManualProgressService {
  private readonly logger = new Logger(ImportacaoManualProgressService.name);
  private progress: ImportacaoManualProgress | null = null;

  getProgress(): ImportacaoManualProgress | null {
    return this.progress ? { ...this.progress, logs: [...this.progress.logs] } : null;
  }

  estaEmExecucao(): boolean {
    return this.progress?.status === 'running';
  }

  assertPodeIniciar(): void {
    if (this.estaEmExecucao()) {
      throw new ConflictException(
        'Já existe uma importação manual em andamento. Aguarde a conclusão.',
      );
    }
  }

  iniciar(params: {
    tipo: ImportacaoManualTipo;
    unidade: string;
    agente?: string;
    message?: string;
    segmentosTotal?: number;
  }): void {
    this.assertPodeIniciar();
    const now = new Date().toISOString();
    this.progress = {
      status: 'running',
      tipo: params.tipo,
      fase: 'iniciando',
      message: params.message ?? 'Iniciando importação...',
      agente: params.agente ?? '',
      unidade: params.unidade,
      total: 0,
      atual: 0,
      percentual: 0,
      criados: 0,
      atualizados: 0,
      erros: 0,
      segmentoAtual: 0,
      segmentosTotal: params.segmentosTotal ?? 0,
      atualizadoEm: now,
      logs: [],
    };
    this.appendLog(this.progress.message);
  }

  atualizar(
    partial: Partial<
      Omit<ImportacaoManualProgress, 'logs' | 'tipo' | 'unidade'>
    > & {
      fase?: ImportacaoManualFase;
      appendMessage?: string;
    },
  ): void {
    if (!this.progress || this.progress.status !== 'running') {
      return;
    }

    const { appendMessage, ...rest } = partial;
    Object.assign(this.progress, rest);
    this.progress.atualizadoEm = new Date().toISOString();

    if (this.progress.total > 0) {
      this.progress.percentual = Math.min(
        100,
        Math.round((this.progress.atual / this.progress.total) * 100),
      );
    } else if (partial.percentual !== undefined) {
      this.progress.percentual = Math.min(100, Math.max(0, partial.percentual));
    }

    if (appendMessage) {
      this.appendLog(appendMessage);
    } else if (partial.message) {
      this.appendLog(partial.message);
    }
  }

  registrarProcessamento(params: {
    atual: number;
    total: number;
    criados: number;
    atualizados: number;
    erros?: number;
    fase?: ImportacaoManualFase;
    message?: string;
  }): void {
    if (!this.progress || this.progress.status !== 'running') {
      return;
    }

    const shouldLog =
      params.atual === 1 ||
      params.atual === params.total ||
      params.atual % 50 === 0;

    this.atualizar({
      atual: params.atual,
      total: params.total,
      criados: params.criados,
      atualizados: params.atualizados,
      erros: params.erros ?? this.progress.erros,
      fase: params.fase,
      message: params.message,
      appendMessage: shouldLog ? params.message : undefined,
    });
  }

  finalizar(status: ImportacaoManualStatus, message: string): void {
    if (!this.progress) {
      return;
    }

    this.progress.status = status;
    this.progress.fase = status === 'completed' ? 'concluido' : 'erro';
    this.progress.message = message;
    this.progress.atualizadoEm = new Date().toISOString();
    if (status === 'completed') {
      this.progress.percentual = 100;
    }
    this.appendLog(message);
    this.logger.log(
      `[importacao-manual] ${this.progress.tipo} ${status}: ${message}`,
    );
  }

  limpar(): void {
    this.progress = null;
  }

  private appendLog(message: string): void {
    if (!this.progress || !message.trim()) {
      return;
    }

    const entry: ImportacaoManualLogEntry = {
      timestamp: new Date().toISOString(),
      message: message.trim(),
    };

    const ultimo = this.progress.logs[this.progress.logs.length - 1];
    if (ultimo?.message === entry.message) {
      this.progress.atualizadoEm = entry.timestamp;
      return;
    }

    this.progress.logs.push(entry);
    if (this.progress.logs.length > IMPORTACAO_MANUAL_LOG_MAX) {
      this.progress.logs.shift();
    }
  }
}
