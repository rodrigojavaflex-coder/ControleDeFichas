import { Unidade } from './usuario.model';

export interface VisitaCorDia {
  id: string;
  diasAcimaDe: number;
  cor: string;
  unidade: Unidade | string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface VisitaCorDiaPayload {
  diasAcimaDe: number;
  cor: string;
  unidade: Unidade | string;
  ativo: boolean;
}
