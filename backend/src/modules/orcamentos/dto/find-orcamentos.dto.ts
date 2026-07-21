import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { Unidade } from '../../../common/enums/unidade.enum';

export const ORCAMENTO_LISTA_STATUS = ['APROVADO', 'REJEITADO', 'TODOS'] as const;
export type OrcamentoListaStatusFiltro = (typeof ORCAMENTO_LISTA_STATUS)[number];

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

export class FindOrcamentosDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ORCAMENTO_LISTA_STATUS,
    description:
      'APROVADO, REJEITADO ou TODOS (requer ambas permissões de leitura)',
  })
  @IsOptional()
  @IsIn(ORCAMENTO_LISTA_STATUS)
  status?: OrcamentoListaStatusFiltro;

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
  @IsDateString({}, { message: 'Data inicial deve ter formato válido (YYYY-MM-DD)' })
  dataInicial?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString({}, { message: 'Data final deve ter formato válido (YYYY-MM-DD)' })
  dataFinal?: string;

  @ApiPropertyOptional({ default: 'dataOrcamento' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description:
      'true = exportação/impressão em massa (exige permissão orcamento:print)',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  relatorio?: boolean;
}
