import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsBoolean,
  Min,
  IsIn,
  Matches,
} from 'class-validator';

export class CreateSincronizacaoConfigDto {
  @ApiProperty({
    description: 'Nome do agente',
    example: 'inhumas',
    enum: ['inhumas', 'uberaba', 'neropolis'],
  })
  @IsString()
  @IsIn(['inhumas', 'uberaba', 'neropolis'])
  agente: string;

  @ApiProperty({
    description: 'Última data de busca de clientes (YYYY-MM-DD)',
    example: '2025-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  ultimaDataCliente?: string;

  @ApiProperty({
    description: 'Última data de busca de prescritores (YYYY-MM-DD)',
    example: '2025-01-01',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  ultimaDataPrescritor?: string;

  @ApiProperty({
    description:
      'Última data/hora de busca de orçamentos (YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss)',
    example: '2026-01-01T00:00:00',
    required: false,
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/, {
    message:
      'ultimaModificacaoOrcamento deve estar no formato YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss',
  })
  ultimaModificacaoOrcamento?: string;

  @ApiProperty({
    description: 'Intervalo em minutos entre sincronizações',
    example: 60,
    default: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  intervaloMinutos?: number;

  @ApiProperty({
    description: 'Se a sincronização está ativa para este agente',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
