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
