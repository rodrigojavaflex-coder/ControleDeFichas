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
  crm_medico: string | null;
  uf_crm_medico: string | null;
  nome_medico: string | null;
  chave_erp: string;
}

export interface CaixaFechamentoDiaRow {
  forma_pagamento: string;
  qtd_baixas: number;
  total_bruto: number;
  total_troco: number;
  total_liquido: number;
}

export interface PainelMedicoRepresentanteRow {
  nome_medico: string;
  uf_crm_medico: string;
  crm_medico: string;
  contrato_representante: number;
  codigo_representante: number;
  nome_representante: string;
}

export interface ProducaoEtapaResumoRow {
  filial: number;
  requisicao: number;
  formula: string;
  cod_etapa: string;
  etapa: string;
  posicao_etapa: number;
  cod_func_entrada?: number | null;
  func_entrada?: string | null;
  cod_func_saida?: number | null;
  func_saida?: string | null;
  data_entrada?: string | null;
  hora_entrada?: string | null;
  data_saida?: string | null;
  hora_saida?: string | null;
  tempo_etapa?: number | null;
  forma_farmaceutica?: string | null;
  quantidade?: number | null;
  unidade_medida?: string | null;
  laboratorio?: string | null;
  tipo_formula?: string | null;
  qtd_principios_ativos: number;
  principios_ativos?: string | null;
  embalagem?: string | null;
  paciente?: string | null;
  codigo_cliente?: number | null;
  cliente?: string | null;
  crf?: string | null;
  uf_crf?: string | null;
  nome_prescritor?: string | null;
  data_retirada?: string | null;
  hora_retirada?: string | null;
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
