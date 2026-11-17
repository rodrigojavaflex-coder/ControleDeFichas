export type StatusSolicitacao = 'ABERTA' | 'RESOLVIDA' | 'CONCLUIDA' | 'REABERTA';

export type FiltroStatusSolicitacao = StatusSolicitacao | 'todas';

export interface SolicitacaoGestao {
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
  unidade: string | null;
  criadoEm: string;
  ultimaDescricao: string | null;
}

export interface SolicitacaoHistorico {
  id: string;
  status: StatusSolicitacao;
  descricao: string;
  usuarioId: string | null;
  usuarioNome: string | null;
  criadoEm: string;
}

export function rotuloStatusSolicitacao(status: StatusSolicitacao): string {
  if (status === 'ABERTA') return 'Aberta';
  if (status === 'RESOLVIDA') return 'Resolvida';
  if (status === 'REABERTA') return 'Reaberta';
  return 'Concluída';
}
