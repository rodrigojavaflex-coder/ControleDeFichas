import { Unidade } from './usuario.model';
import { PaginatedResponse, PaginationMeta } from './usuario.model';

export interface Cliente {
  id: string;
  nome: string;
  cdcliente?: number;
  cpf?: string;
  dataNascimento?: string;
  email?: string;
  telefone?: string;
  unidade: Unidade;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface CreateClienteDto {
  nome: string;
  cdcliente?: number;
  cpf?: string;
  dataNascimento?: string;
  email?: string;
  telefone?: string;
  unidade: Unidade;
}

export interface UpdateClienteDto {
  nome?: string;
  cdcliente?: number;
  cpf?: string;
  dataNascimento?: string;
  email?: string;
  telefone?: string;
  unidade?: Unidade;
}

export interface FindClientesDto {
  page?: number;
  limit?: number;
  nome?: string;
  cpf?: string;
  unidade?: Unidade;
}

export interface ClientePaginatedResponse extends PaginatedResponse<Cliente> {}

