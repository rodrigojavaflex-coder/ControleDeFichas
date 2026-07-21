import { Unidade, PaginatedResponse } from './usuario.model';

export enum OrcamentoStatus {
  APROVADO = 'APROVADO',
  REJEITADO = 'REJEITADO',
}

export interface OrcamentoMotivoRejeicao {
  id: string;
  descricao: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Orcamento {
  id: string;
  unidade: Unidade;
  cdfil: number;
  nrorc: number;
  serieo: string;
  nrOrcamento: string;
  dataOrcamento: string;
  status: OrcamentoStatus;
  precoVenda: number;
  precoCobrado: number;
  descontoFormula: number;
  codigoCliente?: number | null;
  nomeCliente?: string | null;
  codigoVendedor?: number | null;
  nomeVendedor?: string | null;
  nomeMedico?: string | null;
  crmMedico?: string | null;
  ufcrmMedico?: string | null;
  ultimaModificacao: string;
  motivoRejeicaoId?: string | null;
  observacaoRejeicao?: string | null;
  motivoRejeicao?: OrcamentoMotivoRejeicao | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CreateOrcamentoMotivoRejeicaoDto {
  descricao: string;
  ativo?: boolean;
}

export interface UpdateOrcamentoMotivoRejeicaoDto {
  descricao?: string;
  ativo?: boolean;
}

export type OrcamentoListaStatusFiltro = 'APROVADO' | 'REJEITADO' | 'TODOS';

export interface FindOrcamentosDto {
  page?: number;
  limit?: number;
  status?: OrcamentoListaStatusFiltro;
  unidade?: Unidade;
  nrOrcamento?: string;
  nomeCliente?: string;
  nomeVendedor?: string;
  nomesMedico?: string[];
  comMotivo?: boolean;
  motivoRejeicaoId?: string;
  dataInicial?: string;
  dataFinal?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  /** Exportação/impressão em massa (exige orcamento:print na API). */
  relatorio?: boolean;
}

/** @deprecated Use FindOrcamentosDto */
export type FindOrcamentosRejeitadosDto = FindOrcamentosDto;

export interface OrcamentosRejeitadosOpcoesFiltro {
  medicos: OrcamentoMedicoOpcaoFiltro[];
}

export type MedicoOrdenacaoFiltro =
  | 'total'
  | 'aprovados'
  | 'rejeitados'
  | 'alfabetica';

export type MedicoLimiteExibicaoFiltro = 10 | 15 | 20 | 'todos';

export interface OrcamentoMedicoOpcaoFiltro {
  nome: string;
  total: number;
  aprovados: number;
  rejeitados: number;
}

export interface BulkUpdateRejeitadosDto {
  ids: string[];
  motivoRejeicaoId: string;
  observacaoRejeicao?: string;
}

export type OrcamentosRejeitadosPaginatedResponse = PaginatedResponse<Orcamento>;
