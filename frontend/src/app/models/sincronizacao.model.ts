export interface SincronizacaoConfig {
  id: string;
  agente: 'inhumas' | 'uberaba' | 'neropolis';
  ultimaDataCliente?: string;
  ultimaDataPrescritor?: string;
  ultimaModificacaoOrcamento?: string;
  painelContratoRepresentantes?: string;
  ultimaModificacaoProducaoEtapas?: string;
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
  painelContratoRepresentantes?: string;
  ultimaModificacaoProducaoEtapas?: string;
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
  painelProcessados: number;
  painelCriados: number;
  painelAtualizados: number;
  painelRemovidos: number;
  painelHistoricoGravados: number;
  producaoEtapasProcessados: number;
  producaoEtapasCriados: number;
  producaoEtapasAtualizados: number;
  erros: string[];
}

export type SincronizacaoProgressEtapa =
  | 'iniciando'
  | 'buscando'
  | 'clientes'
  | 'prescritores'
  | 'orcamentos'
  | 'painel'
  | 'producao_etapas'
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
  painelProcessados: number;
  producaoEtapasProcessados: number;
  clientesAtual: number;
  clientesTotal: number;
  percentualClientes: number;
  prescritoresAtual: number;
  prescritoresTotal: number;
  percentualPrescritores: number;
  orcamentosAtual: number;
  orcamentosTotal: number;
  percentualOrcamentos: number;
  painelAtual: number;
  painelTotal: number;
  percentualPainel: number;
  producaoEtapasAtual: number;
  producaoEtapasTotal: number;
  percentualProducaoEtapas: number;
  erros: number;
}

export interface SincronizacaoStatus {
  emExecucao: boolean;
  progresso: SincronizacaoProgress | null;
}

export interface ImportarProducaoEtapasDto {
  unidade: string;
  dataInicio: string;
  dataFim: string;
}

export interface ImportarProducaoEtapasResponse {
  unidade: string;
  processados: number;
  criados: number;
  atualizados: number;
  erros: string[];
}

export interface ImportarOrcamentosDto {
  unidade: string;
  dataInicio: string;
  dataFim: string;
}

export interface ImportarOrcamentosResponse {
  unidade: string;
  processados: number;
  criados: number;
  atualizados: number;
  erros: string[];
}
