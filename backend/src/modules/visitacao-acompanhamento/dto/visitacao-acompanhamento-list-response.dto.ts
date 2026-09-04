import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../../common/dto/paginated-response.dto';
import { VisitacaoAcompanhamentoItemDto } from './visitacao-acompanhamento-item.dto';
import { VisitacaoAcompanhamentoTotaisDto } from './visitacao-acompanhamento-totais.dto';
import { VisitacaoAcompanhamentoTotaisRepresentanteDto } from './visitacao-acompanhamento-totais-representante.dto';

export class VisitacaoAcompanhamentoListResponseDto {
  @ApiProperty({ type: [VisitacaoAcompanhamentoItemDto] })
  data: VisitacaoAcompanhamentoItemDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta: PaginationMetaDto;

  @ApiProperty({ type: VisitacaoAcompanhamentoTotaisDto })
  totais: VisitacaoAcompanhamentoTotaisDto;

  @ApiProperty({ type: [VisitacaoAcompanhamentoTotaisRepresentanteDto] })
  totaisPorRepresentante: VisitacaoAcompanhamentoTotaisRepresentanteDto[];

  @ApiProperty({ enum: ['ABERTO', 'FECHADO'] })
  competenciaStatus: 'ABERTO' | 'FECHADO';

  @ApiPropertyOptional({ nullable: true })
  dataUltimoDiaUtil?: string | null;

  @ApiProperty()
  caixaUltimoDiaUtilConfirmado: boolean;

  @ApiProperty()
  podeFechar: boolean;

  @ApiProperty()
  podeReabrir: boolean;

  @ApiPropertyOptional({ nullable: true })
  mensagemGate?: string | null;
}
