import { Unidade } from './usuario.model';
import { PaginatedResponse } from './usuario.model';

export interface Prescritor {
  id: string;
  nome: string;
  numeroCRM?: number;
  UFCRM?: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface CreatePrescritorDto {
  nome: string;
  numeroCRM?: number;
  UFCRM?: string;
}

export interface UpdatePrescritorDto {
  nome?: string;
  numeroCRM?: number;
  UFCRM?: string;
}

export interface FindPrescritoresDto {
  page?: number;
  limit?: number;
  nome?: string;
  numeroCRM?: number;
}

export interface PrescritorPaginatedResponse extends PaginatedResponse<Prescritor> {}

