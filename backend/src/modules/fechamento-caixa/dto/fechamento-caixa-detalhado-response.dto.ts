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
    description: 'Nome do produto baixado (cupons tipo PRODUTO, sem requisição)',
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

export class FechamentoCaixaDetalhadoResponseDto {
  @ApiProperty()
  unidade: string;

  @ApiProperty()
  data: string;

  @ApiProperty({ type: [CaixaBaixaDetalheDto] })
  baixas: CaixaBaixaDetalheDto[];

  @ApiProperty({ type: [CaixaErpPagamentoDetalheDto] })
  erpPagamentos: CaixaErpPagamentoDetalheDto[];

  @ApiProperty()
  totalBaixas: number;

  @ApiProperty()
  totalErpLiquido: number;
}
