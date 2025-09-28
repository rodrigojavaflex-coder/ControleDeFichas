import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsUUID,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuditAction } from '../../../common/enums/auditoria.enum';

export class FindAuditoriaDto {
  @ApiPropertyOptional({
    description: 'Número da página',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Itens por página',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'ID do usuário' })
  @IsOptional()
  @IsUUID()
  usuarioId?: string;

  @ApiPropertyOptional({ description: 'Ação de auditoria', enum: AuditAction })
  @IsOptional()
  @IsEnum(AuditAction)
  acao?: AuditAction;

  @ApiPropertyOptional({ description: 'Nome da entidade' })
  @IsOptional()
  @IsString()
  entidade?: string;

  @ApiPropertyOptional({ description: 'ID da entidade' })
  @IsOptional()
  @IsString()
  entidadeId?: string;

  @ApiPropertyOptional({ description: 'Data de início (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Data de fim (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Endereço IP' })
  @IsOptional()
  @IsString()
  enderecoIp?: string;

  @ApiPropertyOptional({ description: 'Filtrar por descrição (busca parcial)' })
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional({
    description: 'Busca geral por descrição, IP ou nome do usuário',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
