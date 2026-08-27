import { Unidade } from './usuario.model';
import {
  ComercialIncidenciaComissao,
  ComercialTipoBase,
} from './comercial-meta.model';

export interface ComercialComissaoFaixaItem {
  id: string;
  funcionarioId: string;
  tipoBase: ComercialTipoBase;
  percentualMetaDe: number;
  percentualMetaAte: number | null;
  percentualComissao: number;
  valorBonus: number;
  ordem: number;
}

export interface ComercialComissaoVendedorItem {
  funcionarioId: string;
  nome: string;
  unidade: Unidade;
  codigoVendedorErp: number;
  faixasRequisicaoCount: number;
  faixasMarcaPropriaCount: number;
}

export interface ComercialComissaoVendedoresResponse {
  unidade: Unidade;
  itens: ComercialComissaoVendedorItem[];
}

export interface SalvarComercialComissaoFaixaDto {
  funcionarioId: string;
  tipoBase: ComercialTipoBase;
  percentualMetaDe: number;
  percentualMetaAte?: number | null;
  percentualComissao: number;
  valorBonus?: number;
}

export interface CarregarComercialComissaoPadraoPendentesResponse {
  unidade: Unidade;
  vendedoresAfetados: number;
  basesCarregadas: number;
}

export interface ComercialComissaoPoliticaItem {
  tipoBase: ComercialTipoBase;
  incidencia: ComercialIncidenciaComissao;
  percentualMinimoLoja: number | null;
}

export interface ComercialComissaoPoliticaResponse {
  funcionarioId: string;
  itens: ComercialComissaoPoliticaItem[];
}

export interface SalvarComercialComissaoPoliticaDto {
  funcionarioId: string;
  tipoBase: ComercialTipoBase;
  incidencia: ComercialIncidenciaComissao;
  percentualMinimoLoja?: number | null;
}
