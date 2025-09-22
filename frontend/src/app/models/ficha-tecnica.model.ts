export interface FichaTecnica {
  id: string;
  // =============================================================================
  // BLOCO 1: INFORMAÇÕES BÁSICAS
  // =============================================================================
  codigoFormulaCerta: string;
  produto: string;
  pesoMolecular?: string;
  formulaMolecular?: string;
  dcb?: string;
  nomeCientifico?: string;
  revisao?: string;
  
  // =============================================================================
  // BLOCO 2: TESTES - REFERÊNCIA RDC 67/2007 - ITEM 7.3.10
  // =============================================================================
  analise?: string;
  caracteristicasOrganolepticas?: string;
  solubilidade?: string;
  faixaPh?: string;
  faixaFusao?: string;
  peso?: string;
  volume?: string;
  densidadeComCompactacao?: string;
  avaliacaoDoLaudo?: string;
  
  // =============================================================================
  // BLOCO 3: INFORMAÇÕES ADICIONAIS - TRANSCRITOS DAS REFERÊNCIAS - ITEM 7.3.11
  // =============================================================================
  cinzas?: string;
  perdaPorSecagem?: string;
  infraVermelho?: string;
  ultraVioleta?: string;
  teor?: string;
  conservacao?: string;
  observacao01?: string;
  amostragem?: string;
  referenciaBibliografica?: string;
  dataDeAnalise?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface CreateFichaTecnicaDto {
  // =============================================================================
  // BLOCO 1: INFORMAÇÕES BÁSICAS
  // =============================================================================
  codigoFormulaCerta: string;
  produto: string;
  pesoMolecular?: string;
  formulaMolecular?: string;
  dcb?: string;
  nomeCientifico?: string;
  revisao?: string;
  
  // =============================================================================
  // BLOCO 2: TESTES - REFERÊNCIA RDC 67/2007 - ITEM 7.3.10
  // =============================================================================
  analise?: string;
  caracteristicasOrganolepticas?: string;
  solubilidade?: string;
  faixaPh?: string;
  faixaFusao?: string;
  peso?: string;
  volume?: string;
  densidadeComCompactacao?: string;
  avaliacaoDoLaudo?: string;
  
  // =============================================================================
  // BLOCO 3: INFORMAÇÕES ADICIONAIS - TRANSCRITOS DAS REFERÊNCIAS - ITEM 7.3.11
  // =============================================================================
  cinzas?: string;
  perdaPorSecagem?: string;
  infraVermelho?: string;
  ultraVioleta?: string;
  teor?: string;
  conservacao?: string;
  observacao01?: string;
  amostragem?: string;
  referenciaBibliografica?: string;
  dataDeAnalise?: string;
}

export interface UpdateFichaTecnicaDto extends Partial<CreateFichaTecnicaDto> {}

export interface FindFichaTecnicaDto {
  page?: number;
  limit?: number;
  codigoFormulaCerta?: string;
  produto?: string;
  dcb?: string;
  nomeCientifico?: string;
  revisao?: string;
  dataInicialAnalise?: string;
  dataFinalAnalise?: string;
  search?: string;
}

export interface FichaTecnicaPaginatedResponse {
  data: FichaTecnica[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}