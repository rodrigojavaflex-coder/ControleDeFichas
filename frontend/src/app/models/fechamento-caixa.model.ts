import { Unidade } from './usuario.model';

export interface CaixaFormaTotal {
  qtd: number;
  liquido: number;
}

export interface CaixaFormaTotalLinha extends CaixaFormaTotal {
  forma: string;
}

export interface CaixaTerceiroOrigemTotal {
  forma: string;
  origem: string;
  qtd: number;
  liquido: number;
}

export interface ImportarCaixaErpDto {
  unidade: Unidade;
  dataInicio: string;
  dataFim: string;
}

export interface ImportarCaixaErpResponse {
  dataInicio: string;
  dataFim: string;
  unidade: string;
  cdfil: number;
  pagamentosImportados: number;
  pagamentosAtualizados: number;
  itensImportados: number;
  itensAtualizados: number;
  requisicoesImportadas: number;
  requisicoesAtualizadas: number;
  totaisPorForma: Record<string, CaixaFormaTotal>;
  totaisErpNormalizados: Record<string, CaixaFormaTotal>;
  totaisTerceiro: Record<string, CaixaFormaTotal>;
  totaisTerceiroDetalhe: CaixaTerceiroOrigemTotal[];
  totaisConsolidados: Record<string, CaixaFormaTotal>;
  totalLiquido: number;
  totalLiquidoTerceiro: number;
  totalConsolidado: number;
}

export interface CaixaPreviewRow {
  forma: string;
  terceiro: CaixaFormaTotal | null;
  erp: CaixaFormaTotal | null;
  consolidado: CaixaFormaTotal | null;
}

export interface CaixaSaldoInicialUnidade {
  unidade: Unidade;
  saldoInicial: number;
  dataSaldo?: string | null;
}

export interface FechamentoFormaBloco {
  forma: string;
  erp: CaixaFormaTotal | null;
  erpLinhas?: CaixaFormaTotalLinha[];
  terceiroPorOrigem: CaixaTerceiroOrigemTotal[];
  totalForma: number;
}

export type CaixaFechamentoStatus = 'RASCUNHO' | 'CONFIRMADO';

export type CaixaFechamentoStatusExibicao =
  | 'RASCUNHO'
  | 'FECHADO'
  | 'BLOQUEADO';

export interface FechamentoConsolidado {
  unidade: string;
  data: string;
  fechamentoId?: string;
  status?: CaixaFechamentoStatus;
  statusExibicao: CaixaFechamentoStatusExibicao;
  saldoInicial: number;
  totalDespesas: number;
  totalRetirada: number;
  saldoFinalDinheiro: number | null;
  podeEditar: boolean;
  podeReabrir: boolean;
  podeEmitirRelatorio: boolean;
  ultimaDataConfirmada?: string | null;
  podeConfirmar: boolean;
  formas: FechamentoFormaBloco[];
  confirmadoPorNome?: string | null;
}

export interface SalvarFechamentoRascunhoDto {
  unidade: Unidade;
  data: string;
  totalDespesas: number;
  totalRetirada: number;
}

export interface CaixaBaixaDetalhe {
  protocolo: string;
  clienteNome: string | null;
  origem: string;
  tipoDaBaixa: string;
  valorBaixa: number;
  observacao?: string | null;
  dataBaixa: string;
}

export interface CaixaErpPagamentoDetalhe {
  numeroCupom: number;
  numeroRequisicao?: number | null;
  referenciaRequisicao?: string | null;
  descricaoProduto?: string | null;
  codigoTerminal: number;
  formaPagamento: string;
  formaNormalizada: string;
  valorLiquido: number;
  valorPago: number;
  valorTroco: number;
  codigoCliente?: number | null;
  clienteNome?: string | null;
  nomeOperadorCaixa?: string | null;
}

export interface FechamentoCaixaDetalhado {
  unidade: string;
  data: string;
  baixas: CaixaBaixaDetalhe[];
  erpPagamentos: CaixaErpPagamentoDetalhe[];
  totalBaixas: number;
  totalErpLiquido: number;
}

export function normalizarFormaErpPreview(forma: string): string {
  if (forma === 'CONVENIO-DINHEIRO') {
    return 'CONVENIO-DINHEIRO';
  }
  if (forma === 'CARTAO PRE') {
    return 'CARTÃO/PIX';
  }
  if (forma === 'DINHEIRO' || forma === 'DEPOSITO') {
    return forma;
  }
  return forma;
}

export const FORMAS_FECHAMENTO_CAIXA = [
  'DINHEIRO',
  'CARTÃO/PIX',
  'DEPOSITO',
] as const;

export function formaBlocoFechamento(forma: string): string {
  if (forma === 'CONVENIO-DINHEIRO' || forma === 'DINHEIRO') {
    return 'DINHEIRO';
  }
  return normalizarFormaErpPreview(forma);
}

export function ordenarLinhasErpNoBloco(a: string, b: string): number {
  const ordem = ['DINHEIRO', 'CONVENIO-DINHEIRO'];
  const indiceA = ordem.indexOf(a);
  const indiceB = ordem.indexOf(b);
  if (indiceA >= 0 && indiceB >= 0) {
    return indiceA - indiceB;
  }
  if (indiceA >= 0) {
    return -1;
  }
  if (indiceB >= 0) {
    return 1;
  }
  return a.localeCompare(b, 'pt-BR');
}

export function ordenarFormasFechamentoCaixa<T extends { forma: string }>(
  formas: T[],
): T[] {
  const ordem = new Map(
    FORMAS_FECHAMENTO_CAIXA.map((forma, index) => [forma, index]),
  );

  return [...formas].sort((a, b) => {
    const indiceA =
      ordem.get(a.forma as (typeof FORMAS_FECHAMENTO_CAIXA)[number]) ?? 999;
    const indiceB =
      ordem.get(b.forma as (typeof FORMAS_FECHAMENTO_CAIXA)[number]) ?? 999;
    if (indiceA !== indiceB) {
      return indiceA - indiceB;
    }
    return a.forma.localeCompare(b.forma, 'pt-BR');
  });
}
