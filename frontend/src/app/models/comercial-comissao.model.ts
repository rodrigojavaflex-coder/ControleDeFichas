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
  codigosSetor: number[];
  codigosSetorRevendaManipulados: number[];
  considerarConvenios?: boolean;
  considerarTaxas?: boolean;
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
  codigosSetor?: number[];
  codigosSetorRevendaManipulados?: number[];
  considerarConvenios?: boolean;
  considerarTaxas?: boolean;
}

export interface ComercialComissaoPoliticaUnidadeResponse {
  unidade: Unidade;
  codigosSetor: number[];
  codigosSetorRevendaManipulados: number[];
  criterioRanking?: 'PERCENTUAL' | 'VALOR';
  considerarConvenios?: boolean;
  considerarTaxas?: boolean;
}

export interface SalvarComercialComissaoPoliticaUnidadeDto {
  unidade: Unidade;
  codigosSetor?: number[];
  codigosSetorRevendaManipulados?: number[];
  considerarConvenios?: boolean;
  considerarTaxas?: boolean;
}

export interface AplicarComercialComissaoPoliticaUnidadeVendedoresDto {
  unidade: Unidade;
  somenteSemConfiguracao: boolean;
  codigosSetor?: number[];
  codigosSetorRevendaManipulados?: number[];
  considerarConvenios?: boolean;
  considerarTaxas?: boolean;
}

export interface AplicarComercialComissaoPoliticaUnidadeVendedoresResponse {
  unidade: Unidade;
  vendedoresAfetados: number;
  politicasAtualizadas: number;
  somenteSemConfiguracao: boolean;
}

export interface ComercialComissaoRelatorioConfigUnidade {
  unidade: Unidade;
  codigosSetor: number[];
  codigosSetorRevendaManipulados: number[];
  considerarConvenios: boolean;
  considerarTaxas: boolean;
  criterioRanking: 'PERCENTUAL' | 'VALOR';
}

export interface ComercialComissaoRelatorioConfigVendedor {
  funcionarioId: string;
  nome: string;
  codigoVendedorErp: number;
  incidenciaManipulados: ComercialIncidenciaComissao;
  percentualMinimoLojaManipulados: number | null;
  codigosSetorRevendaManipulados: number[];
  incidenciaMarcaPropria: ComercialIncidenciaComissao;
  percentualMinimoLojaMarcaPropria: number | null;
  codigosSetorMarcaPropria: number[];
  considerarConvenios: boolean;
  considerarTaxas: boolean;
  faixasManipulados: number;
  faixasMarcaPropria: number;
}

export interface ComercialComissaoRelatorioConfigResponse {
  unidade: ComercialComissaoRelatorioConfigUnidade;
  vendedores: ComercialComissaoRelatorioConfigVendedor[];
}
