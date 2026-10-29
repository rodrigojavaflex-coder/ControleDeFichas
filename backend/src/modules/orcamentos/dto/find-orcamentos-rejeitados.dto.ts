import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { Unidade } from '../../../common/enums/unidade.enum';

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

function toOptionalNumber(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }
  const n = Number(value);
  return Number.isNaN(n) ? (value as number) : n;
}

export class FindOrcamentosRejeitadosDto extends PaginationDto {
  @ApiPropertyOptional({ enum: Unidade })
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nrOrcamento?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nomeCliente?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nomeVendedor?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Rótulos no formato NOME - UNIDADE',
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsString({ each: true })
  nomesMedico?: string[];

  @ApiPropertyOptional({ description: 'true = com motivo; false = sem motivo' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  comMotivo?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar por motivo de rejeição cadastrado (UUID)',
  })
  @IsOptional()
  @IsUUID('4')
  motivoRejeicaoId?: string;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Data inicial deve ter formato válido (YYYY-MM-DD)' },
  )
  dataInicial?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Data final deve ter formato válido (YYYY-MM-DD)' },
  )
  dataFinal?: string;

  @ApiPropertyOptional({
    description:
      'Filtrar por precoVenda >= valor (exige orcamento:view-valores)',
    example: 500,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber({}, { message: 'Valor maior ou igual deve ser um número' })
  @Min(0, { message: 'Valor maior ou igual deve ser >= 0' })
  valorMaiorIgual?: number;

  @ApiPropertyOptional({
    description:
      'Filtrar por precoVenda <= valor (exige orcamento:view-valores)',
    example: 1000,
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalNumber(value))
  @IsNumber({}, { message: 'Valor menor ou igual deve ser um número' })
  @Min(0, { message: 'Valor menor ou igual deve ser >= 0' })
  valorMenorIgual?: number;

  @ApiPropertyOptional({ default: 'dataOrcamento' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}
