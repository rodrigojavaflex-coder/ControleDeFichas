import { Unidade } from './usuario.model';
import { VendaOrigem } from './venda.model';

export enum TipoDaBaixa {
  DINHEIRO = 'DINHEIRO',
  CARTAO_PIX = 'CARTÃO/PIX',
  DEPOSITO = 'DEPOSITO',
  OUTROS = 'OUTROS',
}

export interface Baixa {
  id: string;
  idvenda: string;
  tipoDaBaixa: TipoDaBaixa;
  valorBaixa: number;
  dataBaixa: string;
  observacao?: string;
  criadoEm: string;
  atualizadoEm: string;
  venda?: {
    id: string;
    protocolo: string;
    cliente: string;
    unidade?: Unidade;
    origem?: VendaOrigem;
    vendedor?: string;
    dataVenda?: string;
  };
}

export interface CreateBaixaDto {
  idvenda: string;
  tipoDaBaixa: TipoDaBaixa;
  valorBaixa: number;
  dataBaixa: string;
  observacao?: string;
}

export interface LancarBaixaDto {
  tipoDaBaixa: TipoDaBaixa;
  valorBaixa: number;
  dataBaixa: string;
  observacao?: string;
}

export interface UpdateBaixaDto extends Partial<CreateBaixaDto> {}

export interface FindBaixasDto {
  page?: number;
  limit?: number;
  idvenda?: string;
  tipoDaBaixa?: TipoDaBaixa;
  dataInicial?: string;
  dataFinal?: string;
}

export interface BaixaPaginatedResponse {
  data: Baixa[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}
