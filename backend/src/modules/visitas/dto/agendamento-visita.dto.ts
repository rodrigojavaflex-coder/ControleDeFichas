import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class FindAgendamentosVisitaDto {
  @ApiPropertyOptional({
    description: 'Filtrar por médico (omitido = todos do usuário)',
  })
  @IsOptional()
  @IsUUID()
  prescritorId?: string;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Início inclusive YYYY-MM-DD (padrão: hoje SP)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataInicio?: string;

  @ApiPropertyOptional({
    example: '2027-11-01',
    description: 'Fim inclusive YYYY-MM-DD (padrão: hoje+365)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataFim?: string;
}

export class ChecarDataAgendamentoDto {
  @ApiProperty({ example: '2026-11-21' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'data deve estar no formato YYYY-MM-DD',
  })
  data: string;
}

export class ChecarDataAgendamentoResultadoDto {
  @ApiProperty()
  data: string;

  @ApiProperty({ description: '0=dom … 6=sáb (calendário civil local)' })
  diaSemana: number;

  @ApiProperty()
  fimDeSemana: boolean;

  @ApiProperty()
  feriado: boolean;

  @ApiPropertyOptional({ nullable: true })
  descricaoFeriado: string | null;

  @ApiProperty()
  sabadoDiaUtil: boolean;

  @ApiProperty({
    description: 'true se sábado/domingo/feriado (aviso ao usuário)',
  })
  requerAviso: boolean;

  @ApiProperty()
  mensagemAviso: string | null;
}

export class CriarAgendamentoVisitaDto {
  @ApiProperty()
  @IsUUID()
  prescritorId: string;

  @ApiProperty({ example: '2026-11-20', description: 'YYYY-MM-DD' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'data deve estar no formato YYYY-MM-DD',
  })
  data: string;

  @ApiProperty({ example: '14:30', description: 'HH:mm (obrigatória)' })
  @IsString()
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'hora deve estar no formato HH:mm',
  })
  hora: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string | null;
}

export class AtualizarAgendamentoVisitaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  prescritorId?: string;

  @ApiPropertyOptional({ example: '2026-11-20' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'data deve estar no formato YYYY-MM-DD',
  })
  data?: string;

  @ApiPropertyOptional({ example: '14:30', nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'hora deve estar no formato HH:mm',
  })
  hora?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string | null;
}

export class AgendamentoVisitaItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  prescritorId: string;

  @ApiProperty()
  prescritorNome: string;

  @ApiProperty()
  crm: string;

  @ApiProperty()
  uf: string;

  @ApiProperty({ example: '2026-11-20' })
  data: string;

  @ApiPropertyOptional({ nullable: true })
  hora: string | null;

  @ApiPropertyOptional({ nullable: true })
  observacao: string | null;
}

export class AgendaAlertasDto {
  @ApiProperty({
    description: 'Pendências ABERTA do visitador',
  })
  pendenciasAbertas: number;

  @ApiProperty({
    description:
      'Pendências RESOLVIDA aguardando validação/conclusão do visitador',
  })
  pendenciasAConcluir: number;

  @ApiProperty({
    description:
      'Agendamentos futuros da semana (agora até o próximo domingo, America/Sao_Paulo); exclui data/hora já passados',
  })
  agendamentosProximos: number;

  @ApiProperty({
    description: 'Soma: abertas + a concluir + agendamentos da semana',
  })
  total: number;
}
