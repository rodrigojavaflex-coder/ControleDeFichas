import { Unidade } from './usuario.model';

export enum ComercialTipoBase {
  REQUISICAO = 'REQUISICAO',
  MARCA_PROPRIA = 'MARCA_PROPRIA',
}

export enum ComercialIncidenciaComissao {
  PROPRIAS = 'PROPRIAS',
  LOJA = 'LOJA',
}

export interface ComercialMetaItem {
  funcionarioId: string;
  nome: string;
  unidade: Unidade;
  codigoVendedorErp: number;
  anoMes: string;
  mes: number;
  valorMetaRequisicao: number | null;
  valorMetaMarcaPropria: number | null;
}

export interface ComercialMetaListResponse {
  unidade: Unidade;
  ano: number;
  mes: number | null;
  metaUnidadeRequisicao: number | null;
  metaUnidadeMarcaPropria: number | null;
  itens: ComercialMetaItem[];
}

export interface SalvarComercialMetaDto {
  funcionarioId: string;
  anoMes: string;
  tipoBase: ComercialTipoBase;
  valorMeta: number;
}

export interface SalvarComercialMetaUnidadeDto {
  unidade: Unidade;
  anoMes: string;
  valorMetaRequisicao: number;
  valorMetaMarcaPropria: number;
}

export interface CopiarComercialMetaDto {
  unidade: Unidade;
  anoMesOrigem: string;
  anoMesDestino: string;
  percentualAumentoRequisicao?: number;
  percentualAumentoMarcaPropria?: number;
}

export interface CopiarComercialMetaResponse {
  copiados: number;
  lista: ComercialMetaListResponse;
}
