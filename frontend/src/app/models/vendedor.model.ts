import { Unidade } from './usuario.model';
import { PaginatedResponse } from './usuario.model';

export interface Vendedor {
  id: string;
  nome: string;
  cdVendedor?: number;
  unidade: Unidade;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface CreateVendedorDto {
  nome: string;
  cdVendedor?: number;
  unidade: Unidade;
}

export interface UpdateVendedorDto {
  nome?: string;
  cdVendedor?: number;
  unidade?: Unidade;
}

export interface FindVendedoresDto {
  page?: number;
  limit?: number;
  nome?: string;
  unidade?: Unidade;
}

export interface VendedorPaginatedResponse extends PaginatedResponse<Vendedor> {}

