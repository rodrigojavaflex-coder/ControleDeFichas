import { Unidade } from './usuario.model';

export interface VisitacaoMetaItem {
  funcionarioId: string;
  nome: string;
  unidade: Unidade;
  anoMes: string;
  mes: number;
  valorMeta: number | null;
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
