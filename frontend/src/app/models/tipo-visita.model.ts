import { Unidade } from './usuario.model';

export interface TipoVisita {
  id: string;
  nome: string;
  unidade: Unidade | string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface TipoVisitaPayload {
  nome: string;
  unidade: Unidade | string;
  ativo: boolean;
}
