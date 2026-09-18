import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsUUID,
  IsInt,
  Min,
  Max,
  MaxLength,
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
  @MaxLength(120)
  enderecoIp?: string;

  @ApiPropertyOptional({ description: 'Filtrar por descrição (busca parcial)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  descricao?: string;

  @ApiPropertyOptional({
    description:
      'Busca parcial sem acento em descrição, IP, nome do usuário, entidadeId e, com 3+ caracteres, no JSON de dadosAnteriores/dadosNovos',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
