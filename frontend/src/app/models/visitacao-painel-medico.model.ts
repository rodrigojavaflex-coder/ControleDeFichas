import { Unidade } from './usuario.model';

export interface PainelMedicoRepresentante {
  id: string;
  unidade: Unidade;
  nomeMedico: string;
  ufCrmMedico: string;
  crmMedico: string;
  contratoRepresentante: number;
  codigoRepresentante: number;
  nomeRepresentanteErp: string;
  nomeRepresentante?: string | null;
  funcionarioId?: string | null;
  vinculadoFuncionario: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface VisitacaoPainelMedicoRepresentante {
  id: string;
  nome: string;
  unidade: Unidade;
  painelContratoRepresentante: number;
  painelCodigoRepresentante: number;
}

export interface FindVisitacaoPainelMedicoDto {
  page?: number;
  limit?: number;
  unidade?: Unidade;
  nomeMedico?: string;
  crmMedico?: string;
  ufCrmMedico?: string;
  nomeRepresentante?: string;
  funcionarioId?: string;
  codigoRepresentante?: number;
}

export interface VisitacaoPainelMedicoPaginatedResponse {
  data: PainelMedicoRepresentante[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}
