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
  valorMetaMarcaPropria?: number | null;
  percentualMetaMarcaPropria?: number | null;
  valorProjetadoMarcaPropria?: number | null;
  percentualProjecaoMarcaPropria?: number | null;
  percentualComissaoFaixaMarcaPropria?: number | null;
  valorComissaoMarcaPropria?: number | null;
  valorBonusMarcaPropria?: number | null;
  valorComissaoProjetadoMarcaPropria?: number | null;
  valorBonusProjetadoMarcaPropria?: number | null;
  diasUteisMes?: number | null;
  diasRealizados?: number | null;
  mesAberto?: boolean;
}

export interface ComercialAcompanhamentoTotais {
  valorRecebidoRequisicao: number;
  quantidadeRecebidoRequisicao: number;
  valorRecebidoMarcaPropria: number;
  quantidadeRecebidoMarcaPropria: number;
  valorRejeitado: number;
  quantidadeRejeitado: number;
  quantidadeVendedores: number;
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
