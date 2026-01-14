import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, IsInt, IsBoolean, Min, IsIn } from 'class-validator';

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
