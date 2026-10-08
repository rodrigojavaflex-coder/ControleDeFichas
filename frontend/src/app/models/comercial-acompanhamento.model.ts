import { Unidade } from './usuario.model';

export interface FindComercialAcompanhamentoDto {
  unidade: Unidade;
  ano: number;
  mes: number;
  funcionarioId?: string;
}

export interface ComercialAcompanhamentoItem {
  funcionarioId: string | null;
  nomeVendedor: string;
  codigoVendedorErp: number | null;
  valorRecebidoRequisicao: number;
  quantidadeRecebidoRequisicao: number;
  quantidadeFormulasRequisicao: number;
  valorRequisicaoPura: number;
  valorRevendaManipulados: number;
  quantidadeRevendaManipulados: number;
  codigosSetorRevendaManipulados?: number[];
  valorTerceirosManipulados: number;
  quantidadeTerceirosManipulados: number;
  valorComissaoBaseRequisicao: number;
  valorRecebidoMarcaPropria: number;
  quantidadeRecebidoMarcaPropria: number;
  valorRejeitado: number;
  quantidadeRejeitado: number;
  valorMetaRequisicao?: number | null;
  percentualMetaRequisicao?: number | null;
  valorProjetadoRequisicao?: number | null;
  percentualProjecaoRequisicao?: number | null;
  percentualComissaoFaixaRequisicao?: number | null;
  valorComissaoRequisicao?: number | null;
  valorBonusRequisicao?: number | null;
  valorComissaoProjetadoRequisicao?: number | null;
  valorBonusProjetadoRequisicao?: number | null;
  percentualComissaoFaixaProjetadoRequisicao?: number | null;
  valorMetaMarcaPropria?: number | null;
  percentualMetaMarcaPropria?: number | null;
  valorProjetadoMarcaPropria?: number | null;
  percentualProjecaoMarcaPropria?: number | null;
  percentualComissaoFaixaMarcaPropria?: number | null;
  valorComissaoMarcaPropria?: number | null;
  valorBonusMarcaPropria?: number | null;
  valorComissaoProjetadoMarcaPropria?: number | null;
  valorBonusProjetadoMarcaPropria?: number | null;
  percentualComissaoFaixaProjetadoMarcaPropria?: number | null;
  diasUteisMes?: number | null;
  diasRealizados?: number | null;
  mesAberto?: boolean;
}

export interface ComercialAcompanhamentoTotais {
  valorRecebidoRequisicao: number;
  quantidadeRecebidoRequisicao: number;
  quantidadeFormulasRequisicao: number;
  valorRequisicaoPura: number;
  valorRevendaManipulados: number;
  quantidadeRevendaManipulados: number;
  codigosSetorRevendaManipulados?: number[];
  valorTerceirosManipulados: number;
  quantidadeTerceirosManipulados: number;
  valorComissaoBaseRequisicao: number;
  valorRecebidoMarcaPropria: number;
  quantidadeRecebidoMarcaPropria: number;
  valorRejeitado: number;
  quantidadeRejeitado: number;
  quantidadeVendedores: number;
  codigosSetorMarcaPropria?: number[];
  valorRecebidoMarcaPropriaSetores?: number;
  quantidadeRecebidoMarcaPropriaSetores?: number;
  valorMetaRequisicao?: number | null;
  percentualMetaRequisicao?: number | null;
  valorMetaMarcaPropria?: number | null;
  percentualMetaMarcaPropria?: number | null;
  valorProjetadoRequisicao?: number | null;
  percentualProjecaoRequisicao?: number | null;
  valorProjetadoMarcaPropria?: number | null;
  percentualProjecaoMarcaPropria?: number | null;
  diasUteisMes?: number | null;
  diasRealizados?: number | null;
  mesAberto?: boolean;
}

export interface ComercialAcompanhamentoListResponse {
  itens: ComercialAcompanhamentoItem[];
  totais: ComercialAcompanhamentoTotais;
  anoMes: string;
  dataInicial: string;
  dataFinal: string;
}

export interface ComercialAcompanhamentoVendedorOpcao {
  funcionarioId: string;
  nome: string;
  codigoVendedorErp: number;
}

export interface ComercialAcompanhamentoMovimentoRequisicao {
  data: string;
  numeroCupom: number;
  numeroRequisicao: number;
  valor: number;
}

export interface ComercialAcompanhamentoMovimentoProduto {
  data: string;
  numeroCupom: number;
  descricaoItem?: string | null;
  quantidade: number;
  valor: number;
}

export interface ComercialAcompanhamentoMovimentoSetor {
  data: string;
  numeroCupom: number;
  descricaoItem?: string | null;
  codigoSetor?: number | null;
  quantidade: number;
  valor: number;
}

export interface ComercialAcompanhamentoMovimentoRejeitado {
  dataOrcamento: string;
  nrOrcamento: string;
  nomeCliente?: string | null;
  precoVenda: number;
  motivoRejeicao?: string | null;
}

export interface ComercialAcompanhamentoMovimentoTerceiro {
  dataBaixa: string;
  protocolo: string;
  dataVenda?: string | null;
  nomeCliente?: string | null;
  valor: number;
}

export interface ComercialAcompanhamentoDetalhe {
  funcionarioId: string | null;
  nomeVendedor: string;
  codigoVendedorErp: number | null;
  isTotal?: boolean;
  manipulados: ComercialAcompanhamentoMovimentoRequisicao[];
  setor: ComercialAcompanhamentoMovimentoSetor[];
  marcaPropria: ComercialAcompanhamentoMovimentoProduto[];
  rejeitados: ComercialAcompanhamentoMovimentoRejeitado[];
  terceiros: ComercialAcompanhamentoMovimentoTerceiro[];
}
