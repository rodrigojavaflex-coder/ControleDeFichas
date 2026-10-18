import { Unidade } from './usuario.model';
import { VisitacaoPainelMedicoRepresentante } from './visitacao-painel-medico.model';

export type VisitacaoAnaliseNaCarteira = 'todos' | 'sim' | 'nao';
export type VisitacaoAnaliseModo = 'comparar' | 'ranking';

export interface VisitacaoAnaliseCompetencia {
  key: string;
  ano: number;
  mes: number;
  fonte: 'FECHADO';
  label: string;
}

export interface VisitacaoAnaliseOpcoes {
  unidade: Unidade;
  competenciasDisponiveis: VisitacaoAnaliseCompetencia[];
  representantes: VisitacaoPainelMedicoRepresentante[];
  analise?: VisitacaoAnaliseResponse | null;
}

export interface FindVisitacaoAnaliseOpcoesDto {
  unidade?: Unidade;
  /** Bootstrap: opções + análise das duas últimas competências fechadas (modo comparar). */
  comAnalise?: boolean;
}

export interface FindVisitacaoAnaliseDto {
  modo?: VisitacaoAnaliseModo;
  /** Competência base YYYY-MM (modo comparar). */
  c1?: string;
  /** Competência referência YYYY-MM (modo comparar). */
  c2?: string;
  /** Competências YYYY-MM (modo ranking). */
  competencias?: string[];
  unidade?: Unidade;
  funcionarioId?: string;
  nomeMedico?: string;
  naCarteira?: VisitacaoAnaliseNaCarteira;
  top?: number;
}

export interface VisitacaoAnaliseMedico {
  crmMedico: string;
  ufCrmMedico: string;
  nomeMedico: string;
  nomeRepresentante: string | null;
  valorMes1: number | null;
  valorMes2: number | null;
  valorPeriodo: number | null;
  valorMedia: number | null;
  delta: number;
  percentual: number | null;
}

export interface VisitacaoAnaliseResponse {
  unidade: Unidade;
  modo: VisitacaoAnaliseModo;
  competencias: VisitacaoAnaliseCompetencia[];
  competencia1: VisitacaoAnaliseCompetencia | null;
  competencia2: VisitacaoAnaliseCompetencia | null;
  agregacao: 'soma' | null;
  filtrosAplicados: {
    funcionarioId: string | null;
    nomeMedico: string | null;
    naCarteira: VisitacaoAnaliseNaCarteira;
  };
  crescimento: VisitacaoAnaliseMedico[];
  queda: VisitacaoAnaliseMedico[];
  maioresVendas: VisitacaoAnaliseMedico[];
  maioresRejeitados: VisitacaoAnaliseMedico[];
}
