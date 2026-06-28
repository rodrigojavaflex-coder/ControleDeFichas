import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';
import { OrcamentoStatus } from '../../../common/enums/orcamento-status.enum';

export type GranularidadeTemporal = 'dia' | 'mes';

function toStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.map(String).filter((s) => s.trim() !== '');
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return [value.trim()];
  }
  return undefined;
}

export class FindOrcamentosDashboardDto {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString({}, { message: 'Data inicial deve ter formato válido (YYYY-MM-DD)' })
  dataInicial?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString({}, { message: 'Data final deve ter formato válido (YYYY-MM-DD)' })
  dataFinal?: string;

  @ApiPropertyOptional({ enum: Unidade, isArray: true })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsEnum(Unidade, { each: true })
  unidades?: Unidade[];

  @ApiPropertyOptional({
    description: 'Nomes de vendedor (agrupamento por nome)',
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsString({ each: true })
  nomesVendedor?: string[];

  @ApiPropertyOptional({
    description: 'Nomes de médico (agrupamento por nome)',
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsString({ each: true })
  nomesMedico?: string[];

  @ApiPropertyOptional({ enum: OrcamentoStatus, isArray: true })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsEnum(OrcamentoStatus, { each: true })
  status?: OrcamentoStatus[];

  @ApiPropertyOptional({ enum: ['dia', 'mes'], default: 'mes' })
  @IsOptional()
  @IsIn(['dia', 'mes'])
  granularidadeTemporal?: GranularidadeTemporal;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  topVendedores?: number;
}
