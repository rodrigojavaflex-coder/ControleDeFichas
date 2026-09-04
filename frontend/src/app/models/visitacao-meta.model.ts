import { Unidade } from './usuario.model';

export interface VisitacaoPainelConflito {
  crm: string;
  uf: string;
  nomeMedico: string;
  unidades: Unidade[];
  representantes: string[];
}

export interface VisitacaoMetaItem {
  funcionarioId: string;
  nome: string;
  unidade: Unidade;
  anoMes: string;
  mes: number;
  valorMeta: number | null;
  unidadesComissao: Unidade[];
  quantidadeConflitosPainel: number;
}

export interface UnidadesComissaoResponse {
  funcionarioId: string;
  unidadesComissao: Unidade[];
  quantidadeConflitosPainel: number;
  conflitos: VisitacaoPainelConflito[];
}

export interface VisitacaoMetaListResponse {
  unidade: Unidade;
  ano: number;
  mes: number | null;
  itens: VisitacaoMetaItem[];
}

export interface SalvarVisitacaoMetaDto {
  funcionarioId: string;
  anoMes: string;
  valorMeta: number;
}

export interface CopiarVisitacaoMetaDto {
  unidade: Unidade;
  anoMesOrigem: string;
  anoMesDestino: string;
}

export interface CopiarVisitacaoMetaResponse {
  copiados: number;
  lista: VisitacaoMetaListResponse;
}
