import { Unidade } from './usuario.model';

export type ComercialAnaliseModo = 'comparar' | 'ranking' | 'evolucao' | 'semanas';
export type ComercialAnaliseDimensao = 'vendedor' | 'unidade';
export type ComercialAnaliseMetrica = 'valor' | 'quantidade' | 'ticketMedio';
export type ComercialAnaliseBase =
  | 'manipuladosRequisicoes'
  | 'manipuladosSetor'
  | 'manipuladosTerceiros'
  | 'manipulados'
  | 'marcaPropriaSetores'
  | 'marcaPropriaOutros'
  | 'marcaPropria'
  | 'totalVendido';
export type ComercialAnaliseLeitura = 'comparar' | 'evolucao';

export interface ComercialAnalisePeriodo {
  key: string;
  label: string;
  labelCurto: string;
  previa: boolean;
  inicio: string;
  fim: string;
}

export interface ComercialAnaliseVendedorOpcao {
  funcionarioId: string;
  nome: string;
  codigoVendedorErp: number;
}

export interface ComercialAnaliseOpcoes {
  unidade: Unidade | null;
  unidadesDisponiveis: Unidade[];
  escopoFixo: boolean;
  anoCorrente: number;
  competencias: ComercialAnalisePeriodo[];
  /** Competência usada para montar as semanas (última com movimento se omitida). */
  competenciaSemanas: string | null;
  semanas: ComercialAnalisePeriodo[];
  vendedores: ComercialAnaliseVendedorOpcao[];
}

export interface FindComercialAnaliseOpcoesDto {
  unidade?: Unidade;
  /** Competência das semanas (YYYY-MM). Omitido = última com movimento. */
  competenciaSemanas?: string;
}

export interface FindComercialAnaliseDto {
  modo?: ComercialAnaliseModo;
  dimensao?: ComercialAnaliseDimensao;
  metrica?: ComercialAnaliseMetrica;
  base?: ComercialAnaliseBase;
  leitura?: ComercialAnaliseLeitura;
  /** Competência do modo semanas (YYYY-MM). */
  competencia?: string;
  c1?: string;
  c2?: string;
  competencias?: string[];
  s1?: string;
  s2?: string;
  unidade?: Unidade;
  /** Só dimensao=unidade (gestão). Omitido = todas; vazio = nenhuma. */
  unidades?: Unidade[];
  /** Só dimensao=vendedor. Omitido = todos; vazio = nenhum. */
  funcionarioIds?: string[];
}

export interface ComercialAnaliseLinha {
  funcionarioId: string;
  nomeVendedor: string;
  codigoVendedorErp: number;
  valorMes1: number | null;
  valorMes2: number | null;
  valorPeriodo: number | null;
  valorMedia: number | null;
  serie?: Array<number | null>;
  delta: number;
  percentual: number | null;
}

export interface ComercialAnaliseResponse {
  unidade: Unidade | null;
  modo: ComercialAnaliseModo;
  periodos: ComercialAnalisePeriodo[];
  periodo1: ComercialAnalisePeriodo | null;
  periodo2: ComercialAnalisePeriodo | null;
  agregacao: 'soma' | null;
  filtrosAplicados: {
    dimensao: ComercialAnaliseDimensao;
    unidades: Unidade[];
    funcionarioIds: string[];
    metrica: ComercialAnaliseMetrica;
    base: ComercialAnaliseBase;
    leitura: ComercialAnaliseLeitura | null;
  };
  crescimento: ComercialAnaliseLinha[];
  queda: ComercialAnaliseLinha[];
  maioresVendas: ComercialAnaliseLinha[];
  maioresRejeitados: ComercialAnaliseLinha[];
}

/** Resumo enxuto do widget da home (GET /comercial/analise/home). */
export interface ComercialAnaliseHomeDestaque {
  funcionarioId: string;
  nomeVendedor: string;
  delta: number;
  percentual: number | null;
  valorSemanaAtual: number;
}

export interface ComercialAnaliseHomeRejeitado {
  funcionarioId: string;
  nomeVendedor: string;
  valor: number;
}

export interface ComercialAnaliseHomeUnidadeCard {
  unidade: Unidade;
  maiorCrescimento: ComercialAnaliseHomeDestaque | null;
  maiorQueda: ComercialAnaliseHomeDestaque | null;
  maiorRejeitado: ComercialAnaliseHomeRejeitado | null;
}

export interface ComercialAnaliseHomeResponse {
  semanaAtual: ComercialAnalisePeriodo;
  semanaAnterior: ComercialAnalisePeriodo | null;
  temComparacao: boolean;
  itens: ComercialAnaliseHomeUnidadeCard[];
}
