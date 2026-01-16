export enum VendaOrigem {
  GOIANIA = 'GOIANIA',
  INHUMAS = 'INHUMAS',
  UBERABA = 'UBERABA',
  NEROPOLIS = 'NEROPOLIS',
  RIBEIRAO_PRETO = 'RIBEIRAO_PRETO',
  OUTRO = 'OUTRO',
}

export enum VendaStatus {
  REGISTRADO = 'REGISTRADO',
  CANCELADO = 'CANCELADO',
  PAGO = 'PAGO',
  PAGO_PARCIAL = 'PAGO_PARCIAL',
  FECHADO = 'FECHADO',
}

export enum Unidade {
  INHUMAS = 'INHUMAS',
  NERÓPOLIS = 'NERÓPOLIS',
  UBERABA = 'UBERABA',
}

export enum TipoAtualizacao {
  FORMULA_CERTA_AGENTE = 'FORMULA_CERTA_AGENTE',
  VALOR_CLIENTE = 'VALOR_CLIENTE',
}

import { Cliente } from './cliente.model';
import { Vendedor } from './vendedor.model';
import { Prescritor } from './prescritor.model';

export interface Venda {
  id: string;
  protocolo: string;
  dataVenda: string;
  dataFechamento?: string | null;
  dataEnvio?: string | null;
  clienteId: string;
  cliente: Cliente;
  origem: VendaOrigem;
  vendedorId: string;
  vendedor: Vendedor;
  prescritorId?: string;
  prescritor?: Prescritor;
  valorCompra?: number | null;
  valorCliente: number;
  valorPago?: number | null;
  observacao?: string;
  status: VendaStatus;
  unidade?: Unidade;
  ativo?: string;
  tipoAtualizacao?: TipoAtualizacao;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CreateVendaDto {
  protocolo: string;
  dataVenda: string;
  dataFechamento?: string;
  dataEnvio?: string;
  clienteId: string;
  origem: VendaOrigem;
  vendedorId: string;
  prescritorId?: string;
  valorCompra?: number;
  valorCliente: number;
  valorPago?: number;
  observacao?: string;
  status?: VendaStatus;
  unidade?: Unidade;
  ativo?: string;
}

export interface UpdateVendaDto extends Partial<CreateVendaDto> {}

export interface FindVendasDto {
  page?: number;
  limit?: number;
  protocolo?: string;
  cliente?: string;
  origem?: VendaOrigem | VendaOrigem[];
  vendedor?: string;
  prescritor?: string;
  status?: VendaStatus | VendaStatus[];
  dataInicial?: string;
  dataFinal?: string;
  dataInicialFechamento?: string;
  dataFinalFechamento?: string;
  unidade?: Unidade | Unidade[];
  ativo?: string;
  dataEnvio?: string;
  dataInicialEnvio?: string;
  dataFinalEnvio?: string;
}

export interface VendaPaginatedResponse {
  data: Venda[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

export interface FecharVendaFalha {
  id: string;
  protocolo?: string;
  motivo: string;
}

export interface FecharVendasEmMassaResponse {
  sucesso: Venda[];
  falhas: FecharVendaFalha[];
}
