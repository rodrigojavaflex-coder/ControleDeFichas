export interface VisitacaoRecebidoUnidade {
  unidade: string;
  valor: number;
  quantidade: number;
}

export interface VisitacaoAcompanhamentoMeuCard {
  nomeRepresentante: string;
  funcionarioId?: string | null;
  valorRecebido: number;
  quantidadeRecebido: number;
  valorRejeitado: number;
  quantidadeRejeitado: number;
  quantidadeMedicos: number;
  quantidadeMedicosPainel: number;
  quantidadeMedicosForaAtendimento: number;
  valorMarcaPropria: number;
  quantidadeMarcaPropria: number;
  representatividadePercentual?: number | null;
  recebidoPorUnidade?: VisitacaoRecebidoUnidade[];
  valorMeta?: number | null;
  percentualMeta?: number | null;
  valorProjetado?: number | null;
  percentualProjecao?: number | null;
  percentualComissaoFaixa?: number | null;
  valorComissao?: number | null;
  percentualComissaoFaixaProjetada?: number | null;
  valorComissaoProjetado?: number | null;
  mesAberto: boolean;
  valorBaseOficial: number;
}

export interface VisitacaoAcompanhamentoMeuHome {
  disponivel: boolean;
  motivo?: 'sem_funcionario' | 'sem_representante' | null;
  unidade?: string;
  ano?: number;
  mes?: number;
  competenciaRotulo?: string;
  competenciaStatus?: 'ABERTO' | 'FECHADO';
  dataUltimoCaixaFechado?: string | null;
  diasUteisMes?: number | null;
  diasRealizados?: number | null;
  diasFaltam?: number | null;
  card?: VisitacaoAcompanhamentoMeuCard | null;
}
