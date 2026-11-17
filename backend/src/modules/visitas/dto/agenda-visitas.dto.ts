import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { StatusVisita } from '../enums/status-visita.enum';
import { AgendamentoVisitaItemDto } from './agendamento-visita.dto';

export class FindAgendaVisitasDto {
  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2040)
  ano: number;

  @ApiProperty({ example: 11 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;
}

export class AgendaVisitaDiaItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  prescritorNome: string;

  @ApiProperty()
  crm: string;

  @ApiProperty()
  uf: string;

  @ApiProperty()
  tipoVisitaNome: string;

  @ApiProperty({ enum: StatusVisita })
  status: StatusVisita;

  @ApiProperty()
  dataHoraInicio: string;

  @ApiPropertyOptional({ nullable: true })
  dataHoraFim: string | null;
}

export class AgendaVisitasDiaDto {
  @ApiProperty({ example: '2026-11-03' })
  data: string;

  @ApiProperty()
  quantidadeVisitas: number;

  @ApiProperty({
    description: 'Quantidade de agendamentos do dia (chips vermelhos).',
  })
  quantidadeAgendamentos: number;

  @ApiProperty({ type: [AgendaVisitaDiaItemDto] })
  visitas: AgendaVisitaDiaItemDto[];

  @ApiProperty({ type: [AgendamentoVisitaItemDto] })
  agendamentos: AgendamentoVisitaItemDto[];
}

export class AgendaFeriadoDiaDto {
  @ApiProperty({ example: '2026-11-20' })
  data: string;

  @ApiPropertyOptional({ nullable: true })
  descricao: string | null;
}

export class AgendaVisitasMesDto {
  @ApiProperty()
  ano: number;

  @ApiProperty()
  mes: number;

  @ApiProperty({
    description: 'Unidade do visitador (para feriados/calendário).',
    nullable: true,
  })
  unidade: string | null;

  @ApiProperty({
    description: 'Se sábado conta como dia útil na unidade (RN-CAL-001).',
  })
  sabadoDiaUtil: boolean;

  @ApiProperty({ type: [AgendaFeriadoDiaDto] })
  feriados: AgendaFeriadoDiaDto[];

  @ApiProperty({ type: [AgendaVisitasDiaDto] })
  dias: AgendaVisitasDiaDto[];
}
