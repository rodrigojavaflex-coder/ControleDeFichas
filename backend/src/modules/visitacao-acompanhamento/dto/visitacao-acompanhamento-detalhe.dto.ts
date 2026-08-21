import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class VisitacaoAcompanhamentoMovimentoRecebidoDto {
  @ApiProperty()
  dataPagamento: string;

  @ApiProperty()
  numeroCupom: number;

  @ApiProperty()
  numeroRequisicao: number;

  @ApiPropertyOptional({ nullable: true })
  numeroOrcamento?: number | null;

  @ApiProperty()
  valorPago: number;
}

export class VisitacaoAcompanhamentoMovimentoRejeitadoDto {
  @ApiProperty()
  dataOrcamento: string;

  @ApiProperty()
  nrOrcamento: string;

  @ApiPropertyOptional({ nullable: true })
  nomeCliente?: string | null;

  @ApiProperty()
  precoVenda: number;

  @ApiPropertyOptional({ nullable: true })
  motivoRejeicao?: string | null;
}

export class VisitacaoAcompanhamentoDetalheDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  nomeMedico: string;

  @ApiProperty()
  crmMedico: string;

  @ApiProperty()
  ufCrmMedico: string;

  @ApiProperty({ type: [VisitacaoAcompanhamentoMovimentoRecebidoDto] })
  recebidos: VisitacaoAcompanhamentoMovimentoRecebidoDto[];

  @ApiProperty({ type: [VisitacaoAcompanhamentoMovimentoRejeitadoDto] })
  rejeitados: VisitacaoAcompanhamentoMovimentoRejeitadoDto[];
}
