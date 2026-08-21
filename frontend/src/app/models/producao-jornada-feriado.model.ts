import { Unidade } from './usuario.model';

export const PRODUCAO_DIAS_SEMANA: { diaSemana: number; label: string }[] = [
  { diaSemana: 0, label: 'Domingo' },
  { diaSemana: 1, label: 'Segunda-feira' },
  { diaSemana: 2, label: 'Terça-feira' },
  { diaSemana: 3, label: 'Quarta-feira' },
  { diaSemana: 4, label: 'Quinta-feira' },
  { diaSemana: 5, label: 'Sexta-feira' },
  { diaSemana: 6, label: 'Sábado' },
];

export interface ProducaoJornadaIntervaloUi {
  horaInicio: string;
  horaFim: string;
}

export interface ProducaoJornadaDiaUi {
  diaSemana: number;
  fechado: boolean;
  intervalos: ProducaoJornadaIntervaloUi[];
}

export interface ProducaoJornadaResponse {
  configurado: boolean;
  dias: ProducaoJornadaDiaUi[];
}

export interface SalvarProducaoJornadaDto {
  unidade: Unidade;
  dias: {
    diaSemana: number;
    fechado: boolean;
    intervalos: {
      diaSemana: number;
      ordem: number;
      horaInicio: string;
      horaFim: string;
    }[];
  }[];
}

export interface ProducaoFeriadoItem {
  data: string;
  descricao?: string | null;
  origem?: string;
}

export interface ProducaoFeriadosListaResponse {
  ano: number;
  mes?: number | null;
  feriados: ProducaoFeriadoItem[];
}

export interface ProducaoFeriadoToggleDto {
  unidade: Unidade;
  data: string;
  descricao?: string;
}

export interface ImportarFeriadosNacionaisDto {
  unidade: Unidade;
  ano: number;
}

export interface ImportarFeriadosNacionaisResponse {
  inseridos: number;
  ignorados: number;
}

export interface CalendarioUnidadeResponse {
  unidade: Unidade;
  sabadoDiaUtil: boolean;
}

export interface SalvarCalendarioUnidadeDto {
  unidade: Unidade;
  sabadoDiaUtil: boolean;
}
