export type ImportacaoManualTipo =
  | 'producao_etapas'
  | 'orcamentos'
  | 'caixa_erp';

export type ImportacaoManualFase =
  | 'iniciando'
  | 'consultando_agente'
  | 'gravando_postgres'
  | 'finalizando'
  | 'concluido'
  | 'erro';

export type ImportacaoManualStatus = 'running' | 'completed' | 'error';

export interface ImportacaoManualLogEntry {
  timestamp: string;
  message: string;
}

export interface ImportacaoManualProgress {
  status: ImportacaoManualStatus;
  tipo: ImportacaoManualTipo;
  fase: ImportacaoManualFase;
  message: string;
  agente: string;
  unidade: string;
  total: number;
  atual: number;
  percentual: number;
  criados: number;
  atualizados: number;
  erros: number;
  segmentoAtual: number;
  segmentosTotal: number;
  atualizadoEm: string;
  logs: ImportacaoManualLogEntry[];
}

export const IMPORTACAO_MANUAL_LOG_MAX = 12;
export const IMPORTACAO_MANUAL_PROGRESS_INTERVAL = 50;
