import { Unidade } from './usuario.model';

export interface VisitacaoComissaoRepresentanteItem {
  funcionarioId: string;
  nome: string;
  unidade: Unidade;
  painelContratoRepresentante: number;
  painelCodigoRepresentante: number;
  faixasCount: number;
}

export interface VisitacaoComissaoRepresentantesResponse {
  unidade: Unidade;
  itens: VisitacaoComissaoRepresentanteItem[];
}

export interface VisitacaoComissaoFaixaItem {
  id: string;
  funcionarioId: string;
  percentualMetaDe: number;
  percentualMetaAte: number | null;
  percentualComissao: number;
  ordem: number;
}

export interface SalvarVisitacaoComissaoFaixaDto {
  funcionarioId: string;
  percentualMetaDe: number;
  percentualMetaAte: number | null;
  percentualComissao: number;
}
