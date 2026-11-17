export interface TipoPendenciaItem {
  id: string;
  nome: string;
  descricao: string;
  unidade: string;
  responsavelId: string;
  responsavelNome: string | null;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface TipoPendenciaOpcao {
  id: string;
  nome: string;
  descricao: string;
  responsavelId: string;
  responsavelNome: string | null;
}

export interface ResponsavelTipoPendenciaOpcao {
  id: string;
  nome: string;
}
