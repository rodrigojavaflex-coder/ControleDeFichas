export interface SincronizacaoConfig {
  id: string;
  agente: 'inhumas' | 'uberaba' | 'neropolis';
  ultimaDataCliente?: string;
  ultimaDataPrescritor?: string;
  ultimaModificacaoOrcamento?: string;
  intervaloMinutos: number;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CreateSincronizacaoConfigDto {
  agente: 'inhumas' | 'uberaba' | 'neropolis';
  ultimaDataCliente?: string;
  ultimaDataPrescritor?: string;
  ultimaModificacaoOrcamento?: string;
  intervaloMinutos?: number;
  ativo?: boolean;
}

export interface UpdateSincronizacaoConfigDto extends Partial<CreateSincronizacaoConfigDto> {}

export interface SincronizacaoResult {
  agente: string;
  clientesProcessados: number;
  clientesCriados: number;
  clientesAtualizados: number;
  prescritoresProcessados: number;
  prescritoresCriados: number;
  prescritoresAtualizados: number;
  orcamentosProcessados: number;
  orcamentosCriados: number;
  orcamentosAtualizados: number;
  erros: string[];
}

export type SincronizacaoProgressEtapa =
  | 'iniciando'
  | 'buscando'
  | 'clientes'
  | 'prescritores'
  | 'orcamentos'
  | 'finalizando'
  | 'concluido';

export interface SincronizacaoProgress {
  status: 'running' | 'completed' | 'error';
  message: string;
  agenteAtual: string;
  etapa: SincronizacaoProgressEtapa;
  totalAgentes: number;
  agentesProcessados: number;
  percentual: number;
  clientesProcessados: number;
  prescritoresProcessados: number;
  orcamentosProcessados: number;
  clientesAtual: number;
  clientesTotal: number;
  percentualClientes: number;
  prescritoresAtual: number;
  prescritoresTotal: number;
  percentualPrescritores: number;
  orcamentosAtual: number;
  orcamentosTotal: number;
  percentualOrcamentos: number;
  erros: number;
}
