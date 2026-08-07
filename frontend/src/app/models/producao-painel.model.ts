export type ProducaoPainelAlertaTipo = 'ANTES' | 'ATRASADO';

/** #RRGGBB ou NEUTRO */
export type ProducaoPainelCor = string;

export interface ProducaoPainelAlertaConfig {
  id?: string;
  ordem: number;
  tipo: ProducaoPainelAlertaTipo;
  minutosAntes: number | null;
  cor: ProducaoPainelCor;
  rotulo: string | null;
}

export interface ProducaoPainelRetiradaConfig {
  unidade: string;
  etapasFinalizacao: string[];
  alertas: ProducaoPainelAlertaConfig[];
}

export interface ProducaoPainelLinha {
  unidade: string;
  filial: number;
  requisicao: number;
  formula: string;
  cliente: string | null;
  paciente: string | null;
  nomePrescritor: string | null;
  dataRetirada: string | null;
  horaRetirada: string | null;
  codEtapaAtual: string;
  etapaAtual: string;
  posicaoEtapaAtual: number;
  minutosParaRetirada: number | null;
  corPainel: ProducaoPainelCor;
  rotuloAlerta: string | null;
}

export interface ProducaoPainelResponse {
  unidades: string[];
  consultadoEm: string;
  linhas: ProducaoPainelLinha[];
  legenda: { cor: ProducaoPainelCor; rotulo: string | null }[];
}

export interface ProducaoPainelQuery {
  unidades: string[];
}

export interface ProducaoPainelHistoricoQuery {
  unidade: string;
  filial: number;
  requisicao: number;
  formula: string;
}

export interface ProducaoPainelHistoricoEtapa {
  posicaoEtapa: number;
  codEtapa: string;
  etapa: string;
  dataEntrada: string | null;
  horaEntrada: string | null;
  funcionarioEntrada: string | null;
  dataSaida: string | null;
  horaSaida: string | null;
  funcionarioSaida: string | null;
  tempoEtapaMinutos: number | null;
  emAndamentoFila: boolean;
  dataEntradaFila: string | null;
  horaEntradaFila: string | null;
  funcionarioFila: string | null;
}

export interface ProducaoPainelHistoricoResponse {
  unidade: string;
  filial: number;
  requisicao: number;
  formula: string;
  cliente: string | null;
  paciente: string | null;
  dataRetirada: string | null;
  horaRetirada: string | null;
  consultadoEm: string;
  etapas: ProducaoPainelHistoricoEtapa[];
}

export const ALERTAS_PAINEL_PADRAO: ProducaoPainelAlertaConfig[] = [
  {
    ordem: 0,
    tipo: 'ANTES',
    minutosAntes: 300,
    cor: '#EAB308',
    rotulo: 'Faltam até 5 horas',
  },
  {
    ordem: 1,
    tipo: 'ANTES',
    minutosAntes: 120,
    cor: '#F97316',
    rotulo: 'Faltam até 2 horas',
  },
  {
    ordem: 2,
    tipo: 'ATRASADO',
    minutosAntes: null,
    cor: '#DC2626',
    rotulo: 'Retirada atrasada',
  },
];

/** Estado de formulário (horas na UI; API continua em minutos). */
export interface ProducaoPainelAlertaFormRow extends ProducaoPainelAlertaConfig {
  horasAntes: number | null;
}
