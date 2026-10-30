/** Política de persistência em sincronizacao_log_erro por agente. */
export type SincronizacaoNivelLog =
  | 'todos'
  | 'alertas'
  | 'erros'
  | 'nao_gravar';

export interface SincronizacaoConfig {
  id: string;
  agente: 'inhumas' | 'uberaba' | 'neropolis';
  ultimaDataCliente?: string;
  ultimaDataPrescritor?: string;
  ultimaModificacaoOrcamento?: string;
  painelContratoRepresentantes?: string;
  ultimaModificacaoProducaoEtapas?: string;
  intervaloMinutos: number;
  /** Lookback/overlap dias (PCP + exclusões + agendamento). Padrão 5. */
  overlapDiasProducaoEtapas?: number;
  /** todos | alertas | erros | nao_gravar. Padrão todos. */
  nivelLogSync?: SincronizacaoNivelLog;
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
  overlapDiasProducaoEtapas?: number;
  nivelLogSync?: SincronizacaoNivelLog;
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
  orcamentosRemovidos?: number;
  painelProcessados: number;
  painelCriados: number;
  painelAtualizados: number;
  painelRemovidos: number;
  painelHistoricoGravados: number;
  producaoEtapasProcessados: number;
  producaoEtapasCriados: number;
  producaoEtapasAtualizados: number;
  producaoEtapasFormulasExcluidas: number;
  producaoEtapasRemovidas: number;
  caixaErpDiasProcessados?: number;
  caixaErpDiasDetalhes?: number;
  caixaErpDiasUpsert?: number;
  caixaErpDiasComErro?: number;
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
  | 'caixa_erp'
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

export interface ProducaoEtapaDisponivelLimpeza {
  codEtapa: string;
  etapa: string;
  posicaoEtapa: number;
}

export interface LimparProducaoEtapasAntigasDto {
  unidade: string;
  dataLimite: string;
  etapasFinais: string[];
}

export interface FormulaAmostraLimpeza {
  filial: number;
  requisicao: number;
  formula: string;
  minDataEntrada?: string | null;
}

export interface LimparProducaoEtapasAntigasResponse {
  unidade: string;
  dataLimite: string;
  etapasFinais: string[];
  linhasAbertos: number;
  linhasFila: number;
  formulasSemFim: number;
  linhasFormulasSemFim: number;
  totalLinhas: number;
  amostraFormulasSemFim: FormulaAmostraLimpeza[];
  executado?: boolean;
}

export interface ListarFormulasSemFimLimpezaResponse {
  unidade: string;
  dataLimite: string;
  etapasFinais: string[];
  total: number;
  formulas: FormulaAmostraLimpeza[];
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
  removidos?: number;
  erros: string[];
}

export interface ReparoNomeMedicoSelecao {
  tabela: string;
  id: string;
}

export interface RepararNomesMedicosDto {
  aplicar: boolean;
  unidade?: string;
  itensSelecionados?: ReparoNomeMedicoSelecao[];
  aplicarTodos?: boolean;
}

export interface ReparoNomeMedicoItem {
  id: string;
  tabela: string;
  unidade: string | null;
  crm: string;
  uf: string;
  nomeAtual: string;
  nomeErp: string | null;
  origemErp?: string;
  motivo: string;
  acao: 'corrigir' | 'pendente' | 'sem_crm' | 'igual';
}

export interface RepararNomesMedicosResponse {
  aplicar: boolean;
  unidadeFiltro: string | null;
  totalAnalisado: number;
  suspeitos: number;
  aCorrigir: number;
  corrigidos: number;
  pendentes: number;
  semCrm: number;
  iguais: number;
  agentesConsultados: string[];
  erros: string[];
  paraCorrigir: ReparoNomeMedicoItem[];
  pendentesRelatorio: ReparoNomeMedicoItem[];
}

export interface ImportProfissaoSelecao {
  acao: string;
  id?: string;
  crm: string;
  uf: string;
  pfcrm: string;
}

export interface ImportarProfissaoPrescritoresDto {
  aplicar: boolean;
  unidade?: string;
  itensSelecionados?: ImportProfissaoSelecao[];
  aplicarTodos?: boolean;
}

export interface ImportProfissaoItem {
  id: string | null;
  crm: string;
  uf: string;
  pfcrm: string;
  profissao: string;
  nomeNest: string | null;
  nomeErp: string;
  pfcrmAtual?: string | null;
  origemErp?: string;
  motivo: string;
  acao: 'atualizar' | 'criar' | 'pendente' | 'igual';
}

export interface ImportarProfissaoPrescritoresResponse {
  aplicar: boolean;
  unidadeFiltro: string | null;
  totalAnalisado: number;
  aAplicar: number;
  aplicados: number;
  pendentes: number;
  iguais: number;
  agentesConsultados: string[];
  erros: string[];
  paraAplicar: ImportProfissaoItem[];
  pendentesRelatorio: ImportProfissaoItem[];
}

export interface BackfillPfcrmRetratosDto {
  aplicar: boolean;
  unidade?: string;
}

export interface BackfillPfcrmUnidadeResumo {
  unidade: string;
  /** Linhas em todos os meses fechados (com ou sem PFCRM). */
  medicosTotal: number;
  carteiraTotal: number;
  medicosSemPfcrm: number;
  carteiraSemPfcrm: number;
  medicosPreenchidos: number;
  carteiraPreenchidos: number;
  ambiguos: number;
  semMatch: number;
  /** Resolvidos com PFCRM padrão 1 após dúvida (nome não desambiguou). */
  fallbackPadrao: number;
}

export interface BackfillPfcrmRetratosResponse {
  aplicar: boolean;
  unidadeFiltro: string | null;
  /** Linhas em todos os meses fechados do escopo. */
  medicosTotal: number;
  carteiraTotal: number;
  medicosSemPfcrm: number;
  carteiraSemPfcrm: number;
  medicosPreenchidos: number;
  carteiraPreenchidos: number;
  ambiguos: number;
  semMatch: number;
  /** Linhas ok via fallback PFCRM 1 (MEDICO). */
  fallbackPadrao: number;
  porUnidade: BackfillPfcrmUnidadeResumo[];
  amostraFalhas: string[];
}

export interface SincronizacaoLogErro {
  id: string;
  agente: string;
  etapa: string;
  nivel: 'info' | 'warn' | 'error';
  mensagem: string;
  detalhe?: string | null;
  criadoEm: string;
  atualizadoEm?: string;
}
