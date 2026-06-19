export interface VendasTotalRow {
  unidade: string;
  data: string;
  forma_pagamento: string;
  total_pago: number;
  qtde_linhas: number;
}

export interface ValorCompraRow {
  protocolo: number;
  valor_compra: number;
}

export interface OrcamentoRow {
  ultima_modificacao: string;
  filial: number;
  data_orcamento: string;
  nrorc: number;
  serieo: string;
  nr_orcamento: string;
  status_orcamento: 'APROVADO' | 'REJEITADO';
  preco_venda: number;
  preco_cobrado: number;
  desconto_formula: number;
  codigo_cliente?: number | null;
  nome_cliente?: string | null;
  codigo_vendedor?: number | null;
  nome_vendedor?: string | null;
}
