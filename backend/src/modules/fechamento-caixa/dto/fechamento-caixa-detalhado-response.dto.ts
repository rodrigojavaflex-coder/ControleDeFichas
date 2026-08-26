import { ApiProperty } from '@nestjs/swagger';

export class CaixaBaixaDetalheDto {
  @ApiProperty()
  protocolo: string;

  @ApiProperty({ nullable: true })
  clienteNome: string | null;

  @ApiProperty()
  origem: string;

  @ApiProperty()
  tipoDaBaixa: string;

  @ApiProperty()
  valorBaixa: number;

  @ApiProperty({ required: false, nullable: true })
  observacao?: string | null;

  @ApiProperty({ example: '2026-07-07' })
  dataBaixa: string;
}

export class CaixaErpPagamentoDetalheDto {
  @ApiProperty()
  numeroCupom: number;

  @ApiProperty({ required: false, nullable: true })
  numeroRequisicao?: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Número(s) de requisição do cupom (pode conter várias separadas por vírgula)',
  })
  referenciaRequisicao?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description:
      'Nome do produto baixado (cupons tipo PRODUTO, sem requisição)',
  })
  descricaoProduto?: string | null;

  @ApiProperty()
  codigoTerminal: number;

  @ApiProperty()
  formaPagamento: string;

  @ApiProperty()
  formaNormalizada: string;

  @ApiProperty()
  valorLiquido: number;

  @ApiProperty()
  valorPago: number;

  @ApiProperty()
  valorTroco: number;

  @ApiProperty({ required: false, nullable: true })
  codigoCliente?: number | null;

  @ApiProperty({ required: false, nullable: true })
  clienteNome?: string | null;

  @ApiProperty({ required: false, nullable: true })
  nomeOperadorCaixa?: string | null;
}

export class CaixaErpCortesiaDetalheDto {
  @ApiProperty()
  numeroCupom: number;

  @ApiProperty()
  numeroRequisicao: number;

  @ApiProperty({
    description: 'Valor da fórmula (informativo; não entra no caixa)',
  })
  valorInformativo: number;

  @ApiProperty({ required: false, nullable: true })
  nomeMedico?: string | null;

  @ApiProperty({ required: false, nullable: true })
  crmMedico?: string | null;
}

export class FechamentoCaixaDetalhadoResponseDto {
  @ApiProperty()
  unidade: string;

  @ApiProperty()
  data: string;

  @ApiProperty({ type: [CaixaBaixaDetalheDto] })
  baixas: CaixaBaixaDetalheDto[];

  @ApiProperty({ type: [CaixaErpPagamentoDetalheDto] })
  erpPagamentos: CaixaErpPagamentoDetalheDto[];

  @ApiProperty({
    type: [CaixaErpCortesiaDetalheDto],
    description:
      'Baixas TPRQU=C do dia (informativo; não somam no total do caixa)',
  })
  cortesias: CaixaErpCortesiaDetalheDto[];

  @ApiProperty()
  totalBaixas: number;

  @ApiProperty()
  totalErpLiquido: number;
}
