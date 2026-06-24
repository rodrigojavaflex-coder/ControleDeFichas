import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { Unidade } from '../../../common/enums/unidade.enum';

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

  @ApiPropertyOptional({ description: 'true = com motivo; false = sem motivo' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  comMotivo?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar por motivo de rejeição cadastrado (UUID)' })
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
}
