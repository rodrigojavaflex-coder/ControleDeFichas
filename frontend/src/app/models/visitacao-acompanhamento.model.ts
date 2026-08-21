import { Unidade } from './usuario.model';

export type NaCarteiraFiltro = 'todos' | 'sim' | 'nao';

export type VisitacaoAcompanhamentoOrdenarPor =
  | 'unidade'
  | 'nomeMedico'
  | 'crmMedico'
  | 'nomeRepresentante'
  | 'naCarteira'
  | 'valorRecebido'
  | 'valorRejeitado';

export type VisitacaoAcompanhamentoOrdem = 'asc' | 'desc';

export interface VisitacaoAcompanhamentoItem {
  unidade: Unidade;
  nomeMedico: string;
  crmMedico: string;
  ufCrmMedico: string;
  nomeRepresentante?: string | null;
  naCarteira: boolean;
  unidadeCarteira?: Unidade | null;
  movimentoForaCarteira: boolean;
  valorRecebido: number;
  quantidadeRecebido: number;
  valorRejeitado: number;
  quantidadeRejeitado: number;
}

export interface VisitacaoAcompanhamentoTotais {
  valorRecebido: number;
  quantidadeRecebido: number;
  valorRejeitado: number;
  quantidadeRejeitado: number;
  quantidadeMedicos: number;
}

export interface VisitacaoAcompanhamentoTotaisRepresentante
  extends VisitacaoAcompanhamentoTotais {
  nomeRepresentante: string;
}

export interface FindVisitacaoAcompanhamentoDto {
  page?: number;
  limit?: number;
  dataInicial: string;
  dataFinal: string;
  unidade?: Unidade;
  nomeMedico?: string;
  crmMedico?: string;
  ufCrmMedico?: string;
  funcionarioId?: string;
  naCarteira?: NaCarteiraFiltro;
  nomesMedico?: string[];
  ordenarPor?: VisitacaoAcompanhamentoOrdenarPor;
  ordem?: VisitacaoAcompanhamentoOrdem;
  todos?: boolean;
}

export interface VisitacaoAcompanhamentoListResponse {
  data: VisitacaoAcompanhamentoItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  totais: VisitacaoAcompanhamentoTotais;
  totaisPorRepresentante: VisitacaoAcompanhamentoTotaisRepresentante[];
}

export interface VisitacaoAcompanhamentoMovimentoRecebido {
  dataPagamento: string;
  numeroCupom: number;
  numeroRequisicao: number;
  numeroOrcamento?: number | null;
  valorPago: number;
}

export interface VisitacaoAcompanhamentoMovimentoRejeitado {
  dataOrcamento: string;
  nrOrcamento: string;
  nomeCliente?: string | null;
  precoVenda: number;
  motivoRejeicao?: string | null;
}

export interface VisitacaoAcompanhamentoDetalhe {
  unidade: Unidade;
  nomeMedico: string;
  crmMedico: string;
  ufCrmMedico: string;
  recebidos: VisitacaoAcompanhamentoMovimentoRecebido[];
  rejeitados: VisitacaoAcompanhamentoMovimentoRejeitado[];
}

export interface FindVisitacaoAcompanhamentoDetalheDto {
  unidade: Unidade;
  crmMedico: string;
  ufCrmMedico: string;
  dataInicial: string;
  dataFinal: string;
  nomeMedico?: string;
}

export interface VisitacaoAcompanhamentoOpcoesFiltro {
  medicos: Array<{
    nome: string;
    total: number;
    aprovados: number;
    rejeitados: number;
  }>;
}
