import { StatusSolicitacao } from './enums/status-solicitacao.enum';

export interface MedicoSolicitacaoOpcao {
  id: string;
  nome: string;
  crm: string;
  uf: string;
}

export interface SolicitacaoResumo {
  id: string;
  texto: string;
  status: StatusSolicitacao;
  visitaId: string | null;
  prescritorId: string | null;
  prescritorNome: string | null;
  crm: string | null;
  uf: string | null;
  visitadorId: string | null;
  visitadorNome: string | null;
  tipoPendenciaId: string | null;
  tipoPendenciaNome: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  criadoEm: string;
  ultimaDescricao: string | null;
  noPainel?: boolean | null;
  /** Dias civis desde o registro (America/Sao_Paulo). */
  diasAberta?: number | null;
  rotuloDias?: string | null;
}

export interface SolicitacoesListaPaginada {
  items: SolicitacaoResumo[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  painelDisponivel: boolean;
}

export interface SolicitacaoHistoricoItem {
  id: string;
  status: StatusSolicitacao;
  descricao: string;
  usuarioId: string | null;
  usuarioNome: string | null;
  criadoEm: string;
}

export interface SolicitacaoGestaoItem extends SolicitacaoResumo {
  unidade: string | null;
}

export interface SolicitacaoPainelItem {
  id: string;
  visitaId: string | null;
  texto: string;
  dataHoraInicio: string;
  tipoVisitaNome: string | null;
  visitadorNome: string | null;
}

export interface VisitaParaSolicitacao {
  id: string;
  prescritorId: string;
  usuarioId: string;
  unidade: string;
  pendencia: string | null;
  tipoPendenciaId: string | null;
}
