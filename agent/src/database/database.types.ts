export interface ValorCompraRow {
  protocolo: number;
  valor_compra: number;
}

export interface CaixaPagamentoRow {
  filial: number;
  data: string;
  cupom: number;
  cdtml: number;
  operid: number;
  fmpag: string;
  indrecconv: string;
  forma_pagamento: string;
  valor_bruto: number;
  troco: number;
  valor_liquido: number;
  total_cupom_bruto: number | null;
  total_cupom_liquido: number | null;
  cdcli: number | null;
  codigo_operador: number | null;
  operador_caixa: string | null;
  chave_erp: string;
}

export interface CaixaItemRow {
  filial: number;
  data: string;
  cupom: number;
  cdtml: number;
  operid: number;
  item_cupom: number;
  tipo_item: 'REQUISICAO' | 'PRODUTO';
  codigo_item: number | null;
  requisicao: number | null;
  descricao_item: string | null;
  quant: number;
  valor_item_bruto: number;
  valor_item_liquido: number;
  desconto_item: number;
  pagamento_cupom: number;
  chave_erp: string;
}

export interface CaixaRequisicaoPagaRow {
  filial: number;
  data_pagamento: string;
  requisicao: number;
  cupom: number;
  nr_orcamento: number | null;
  qtd_formulas: number | null;
  valor_orcamento: number | null;
  valor_requisicao_bruto: number;
  desconto_requisicao: number;
  valor_pago_requisicao: number;
  diferenca_calculo: number;
  gap_orcamento_vs_pago: number | null;
  codigo_vendedor: number | null;
  vendedor: string | null;
  chave_erp: string;
}

export interface CaixaFechamentoDiaRow {
  forma_pagamento: string;
  qtd_baixas: number;
  total_bruto: number;
  total_troco: number;
  total_liquido: number;
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
  crm_medico?: string | null;
  ufcrm_medico?: string | null;
  nome_medico?: string | null;
}
