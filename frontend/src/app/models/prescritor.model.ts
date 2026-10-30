import { PaginatedResponse } from './usuario.model';

export interface Prescritor {
  id: string;
  nome: string;
  numeroCRM?: number;
  UFCRM?: string;
  /** Profissão (PFCRM do ERP): 1=MEDICO, 6=NUTRICIONISTA, … */
  pfcrm?: string;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface CreatePrescritorDto {
  nome: string;
  numeroCRM?: number;
  UFCRM?: string;
  pfcrm?: string;
}

export interface UpdatePrescritorDto {
  nome?: string;
  numeroCRM?: number;
  UFCRM?: string;
  pfcrm?: string;
}

export interface FindPrescritoresDto {
  page?: number;
  limit?: number;
  nome?: string;
  numeroCRM?: number;
  pfcrm?: string;
}

export interface PrescritorPaginatedResponse extends PaginatedResponse<Prescritor> {}
