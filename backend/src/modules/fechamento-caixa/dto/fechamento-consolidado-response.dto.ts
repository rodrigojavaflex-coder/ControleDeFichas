import { ApiProperty } from '@nestjs/swagger';
import { CaixaFormaTotalDto } from './importar-caixa-erp-response.dto';
import { CaixaTerceiroOrigemTotalDto } from './caixa-terceiro-origem-total.dto';
import { CaixaFechamentoStatus } from '../enums/caixa-fechamento-status.enum';
import { CaixaFechamentoStatusExibicao } from '../enums/caixa-fechamento-status-exibicao.enum';

export class FechamentoFormaBlocoDto {
  @ApiProperty()
  forma: string;

  @ApiProperty({ type: CaixaFormaTotalDto, nullable: true })
  erp: CaixaFormaTotalDto | null;

  @ApiProperty({ type: [CaixaFormaTotalDto] })
  erpLinhas: Array<CaixaFormaTotalDto & { forma: string }>;

  @ApiProperty({ type: [CaixaTerceiroOrigemTotalDto] })
  terceiroPorOrigem: CaixaTerceiroOrigemTotalDto[];

  @ApiProperty()
  totalForma: number;
}

export class FechamentoConsolidadoResponseDto {
  @ApiProperty()
  unidade: string;

  @ApiProperty()
  data: string;

  @ApiProperty({ required: false })
  fechamentoId?: string;

  @ApiProperty({ enum: CaixaFechamentoStatus, required: false })
  status?: CaixaFechamentoStatus;

  @ApiProperty({ enum: CaixaFechamentoStatusExibicao })
  statusExibicao: CaixaFechamentoStatusExibicao;

  @ApiProperty()
  saldoInicial: number;

  @ApiProperty()
  totalDespesas: number;

  @ApiProperty()
  totalRetirada: number;

  @ApiProperty({ nullable: true })
  saldoFinalDinheiro: number | null;

  @ApiProperty()
  podeEditar: boolean;

  @ApiProperty()
  podeReabrir: boolean;

  @ApiProperty()
  podeEmitirRelatorio: boolean;

  @ApiProperty({ required: false, nullable: true, example: '2026-07-07' })
  ultimaDataConfirmada?: string | null;

  @ApiProperty()
  podeConfirmar: boolean;

  @ApiProperty({ type: [FechamentoFormaBlocoDto] })
  formas: FechamentoFormaBlocoDto[];

  @ApiProperty({ required: false, nullable: true })
  confirmadoPorNome?: string | null;

  @ApiProperty({ required: false, nullable: true })
  observacao?: string | null;
}
