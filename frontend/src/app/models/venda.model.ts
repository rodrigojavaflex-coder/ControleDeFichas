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

export interface Venda {
  id: string;
  protocolo: string;
  dataVenda: string;
  dataFechamento?: string | null;
  dataEnvio?: string | null;
  cliente: string;
  origem: VendaOrigem;
  vendedor: string;
  prescritor?: string;
  valorCompra: number;
  valorCliente: number;
  observacao?: string;
  status: VendaStatus;
  unidade?: Unidade;
  ativo?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface CreateVendaDto {
  protocolo: string;
  dataVenda: string;
  dataFechamento?: string;
  dataEnvio?: string;
  cliente: string;
  origem: VendaOrigem;
  vendedor: string;
  prescritor?: string;
  valorCompra: number;
  valorCliente: number;
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
  origem?: VendaOrigem;
  vendedor?: string;
  prescritor?: string;
  status?: VendaStatus;
  dataInicial?: string;
  dataFinal?: string;
  dataInicialFechamento?: string;
  dataFinalFechamento?: string;
  unidade?: Unidade;
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
  motivo: string;
}

export interface FecharVendasEmMassaResponse {
  sucesso: Venda[];
  falhas: FecharVendaFalha[];
}
