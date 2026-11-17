import { Unidade } from './usuario.model';

export interface TipoPendencia {
  id: string;
  nome: string;
  descricao: string;
  unidade: Unidade | string;
  responsavelId: string;
  responsavelNome: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface TipoPendenciaPayload {
  nome: string;
  descricao: string;
  unidade: Unidade | string;
  responsavelId: string;
  ativo: boolean;
}

export interface TipoPendenciaOpcao {
  id: string;
  nome: string;
  descricao: string;
  responsavelId: string;
  responsavelNome: string | null;
}

export interface ResponsavelTipoPendencia {
  id: string;
  nome: string;
}
