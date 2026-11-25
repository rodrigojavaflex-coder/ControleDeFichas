import { Unidade } from './usuario.model';

export type OrcamentoImagemFaixaTipo = 'TOPO' | 'RODAPE';

export interface OrcamentoImagemAtivo {
  descricao: string;
  quantidade: number;
  unidade: string;
  linha: string;
}

export interface OrcamentoImagemFormula {
  serieo: string;
  ativos: OrcamentoImagemAtivo[];
  embalagem: string;
  valor: number;
}

export interface OrcamentoImagem {
  paciente: string;
  cdfil: number;
  nrorc: number;
  numero: string;
  formulas: OrcamentoImagemFormula[];
  subtotal: number;
  desconto: number;
  total: number;
  geradoEm: string;
  diasValidade: number;
}

export interface GerarOrcamentoImagemRequest {
  unidade: Unidade;
  nrorc: number;
  serieo?: string;
  diasValidade: number;
}
