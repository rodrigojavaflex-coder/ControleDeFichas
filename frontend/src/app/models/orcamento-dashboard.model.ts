import { OrcamentoStatus, OrcamentoMedicoOpcaoFiltro } from './orcamento.model';
import { Unidade } from './usuario.model';

export type GranularidadeTemporal = 'dia' | 'mes';

export interface FindOrcamentosDashboardDto {
  dataInicial?: string;
  dataFinal?: string;
  unidades?: Unidade[];
  nomesVendedor?: string[];
  nomesMedico?: string[];
  status?: OrcamentoStatus[];
  granularidadeTemporal?: GranularidadeTemporal;
  topVendedores?: number;
}

export interface DashboardSerie {
  name: string;
  data: number[];
}

export interface DashboardKpiVolume {
  quantidade: number;
  valor: number;
}

export interface DashboardKpis {
  volumeTotal: DashboardKpiVolume;
  taxaConversao: {
    percentual: number;
    quantidadeAprovada: number;
    quantidadeTotal: number;
  };
  receitaAprovada: DashboardKpiVolume;
  valorPerdido: DashboardKpiVolume;
}

export interface DashboardEvolucaoTemporal {
  granularidade: GranularidadeTemporal;
  labels: string[];
  series: DashboardSerie[];
}

export interface DashboardVendedorDetalhe {
  nomeVendedor: string | null;
  quantidadeTotal: number;
  quantidadeAprovada: number;
  quantidadeRejeitada: number;
  valorAprovado: number;
  taxaConversao: number;
}

export interface DashboardPerformanceVendedor {
  top: number;
  labels: string[];
  series: DashboardSerie[];
  detalhes: DashboardVendedorDetalhe[];
}

export interface DashboardUnidadePerformanceDetalhe {
  unidade: Unidade;
  quantidadeTotal: number;
  quantidadeAprovada: number;
  quantidadeRejeitada: number;
  valorAprovado: number;
  taxaConversao: number;
}

export interface DashboardPerformanceUnidade {
  labels: string[];
  series: DashboardSerie[];
  detalhes: DashboardUnidadePerformanceDetalhe[];
}

export interface DashboardMedicoPerformanceDetalhe {
  nomeMedico: string | null;
  quantidadeTotal: number;
  quantidadeAprovada: number;
  quantidadeRejeitada: number;
  valorAprovado: number;
  taxaConversao: number;
}

export interface DashboardPerformanceMedico {
  top: number;
  labels: string[];
  series: DashboardSerie[];
  detalhes: DashboardMedicoPerformanceDetalhe[];
}

export interface DashboardParetoItem {
  motivoRejeicaoId: string | null;
  descricao: string;
  quantidade: number;
  valorPerdido: number;
  percentualAcumuladoQuantidade: number;
  percentualAcumuladoValor: number;
}

export interface DashboardAnalisePerdas {
  labels: string[];
  series: DashboardSerie[];
  pareto: DashboardParetoItem[];
}

export interface OrcamentosDashboardIndicadores {
  filtrosAplicados: {
    dataInicial?: string | null;
    dataFinal?: string | null;
    unidades: Unidade[];
    nomesVendedor: string[];
    nomesMedico: string[];
    status: OrcamentoStatus[];
    granularidadeTemporal: GranularidadeTemporal;
    topVendedores: number;
    escopoUnidade: Unidade | 'ALL';
    visualizarValores: boolean;
  };
  kpis: DashboardKpis;
  evolucaoTemporal: DashboardEvolucaoTemporal;
  performanceVendedor: DashboardPerformanceVendedor;
  performanceUnidade: DashboardPerformanceUnidade;
  performanceMedico: DashboardPerformanceMedico;
  analisePerdas: DashboardAnalisePerdas;
  meta: {
    campoValor: string;
    campoData: string;
    geradoEm: string;
  };
}

export interface OrcamentosDashboardOpcoesFiltro {
  nomesVendedor: string[];
  medicos: OrcamentoMedicoOpcaoFiltro[];
}
