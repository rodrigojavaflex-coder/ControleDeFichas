import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export const NA_CARTEIRA_FILTRO = ['todos', 'sim', 'nao'] as const;
export type NaCarteiraFiltro = (typeof NA_CARTEIRA_FILTRO)[number];

export const VISITACAO_ACOMPANHAMENTO_ORDENAR_POR = [
  'unidade',
  'nomeMedico',
  'crmMedico',
  'nomeRepresentante',
  'naCarteira',
  'valorRecebido',
  'valorRejeitado',
] as const;
export type VisitacaoAcompanhamentoOrdenarPor =
  (typeof VISITACAO_ACOMPANHAMENTO_ORDENAR_POR)[number];

export const VISITACAO_ACOMPANHAMENTO_ORDEM = ['asc', 'desc'] as const;
export type VisitacaoAcompanhamentoOrdem =
  (typeof VISITACAO_ACOMPANHAMENTO_ORDEM)[number];

function toStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.map(String).filter((s) => s.trim() !== '');
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

export class FindVisitacaoAcompanhamentoDto {
  @ApiProperty({ minimum: 1, default: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ minimum: 1, maximum: 200, default: 50, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiProperty({ example: '2026-08-19' })
  @IsDateString(
    {},
    { message: 'Data inicial deve ter formato válido (YYYY-MM-DD)' },
  )
  dataInicial: string;

  @ApiProperty({ example: '2026-08-20' })
  @IsDateString(
    {},
    { message: 'Data final deve ter formato válido (YYYY-MM-DD)' },
  )
  dataFinal: string;

  @ApiPropertyOptional({
    enum: Unidade,
    description:
      'Unidade (painel da filial). Inclui recebido/rejeitado desses médicos em outras unidades, exceto se o médico já estiver no painel da unidade do movimento.',
  })
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;

  @ApiPropertyOptional({ description: 'Nome do médico (parcial)' })
  @IsOptional()
  @IsString()
  nomeMedico?: string;

  @ApiPropertyOptional({
    description: 'Rótulos NOME - UNIDADE (mesmo padrão do filtro de orçamentos)',
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsString({ each: true })
  nomesMedico?: string[];

  @ApiPropertyOptional({ description: 'CRM do médico (parcial)' })
  @IsOptional()
  @IsString()
  crmMedico?: string;

  @ApiPropertyOptional({ description: 'UF do CRM', example: 'GO' })
  @IsOptional()
  @IsString()
  ufCrmMedico?: string;

  @ApiPropertyOptional({
    description: 'Filtra pela carteira do funcionário vinculado ao painel',
  })
  @IsOptional()
  @IsUUID()
  funcionarioId?: string;

  @ApiPropertyOptional({
    enum: NA_CARTEIRA_FILTRO,
    description: 'Filtro de presença no painel (No Painel)',
    default: 'todos',
  })
  @IsOptional()
  @IsIn(NA_CARTEIRA_FILTRO)
  naCarteira?: NaCarteiraFiltro = 'todos';

  @ApiPropertyOptional({
    enum: VISITACAO_ACOMPANHAMENTO_ORDENAR_POR,
    default: 'valorRecebido',
  })
  @IsOptional()
  @IsIn(VISITACAO_ACOMPANHAMENTO_ORDENAR_POR)
  ordenarPor?: VisitacaoAcompanhamentoOrdenarPor = 'valorRecebido';

  @ApiPropertyOptional({
    enum: VISITACAO_ACOMPANHAMENTO_ORDEM,
    default: 'desc',
  })
  @IsOptional()
  @IsIn(VISITACAO_ACOMPANHAMENTO_ORDEM)
  ordem?: VisitacaoAcompanhamentoOrdem = 'desc';

  @ApiPropertyOptional({
    description: 'Retorna todos os registros (impressão), sem paginação.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  todos?: boolean;
}
