import { Unidade } from './usuario.model';

export interface AcompanhamentoQuery {
  unidades: Unidade[];
}

export interface AcompanhamentoDetalheQuery extends AcompanhamentoQuery {
  codEtapa: string;
}

export interface AcompanhamentoLocalizarQuery extends AcompanhamentoQuery {
  requisicao: number;
  formula?: string;
  filial?: number;
}

export interface AcompanhamentoLocalizarResponse {
  codEtapa: string;
  etapa: string;
  posicaoEtapa: number;
  unidade: Unidade;
  filial: number;
  requisicao: number;
  formula: string;
}

export interface AcompanhamentoEtapaResumo {
  codEtapa: string;
  etapa: string;
  posicaoEtapa: number;
  totalRequisicoesFormulas: number;
  tempoMedioMinutos: number | null;
}

export interface AcompanhamentoResumoResponse {
  unidades: Unidade[];
  etapas: AcompanhamentoEtapaResumo[];
  consultadoEm: string;
}

export interface AcompanhamentoLinhaFila {
  unidade: Unidade;
  filial: number;
  requisicao: number;
  formula: string;
  usuarioEntrada: number | null;
  funcionario: string | null;
  dataEntrada: string | null;
  horaEntrada: string | null;
  tempoDecorridoMinutos: number;
  cliente: string | null;
  paciente: string | null;
  dataRetirada: string | null;
}

export interface AcompanhamentoDetalheResponse {
  codEtapa: string;
  etapa: string;
  posicaoEtapa: number;
  unidades: Unidade[];
  linhas: AcompanhamentoLinhaFila[];
  consultadoEm: string;
}
