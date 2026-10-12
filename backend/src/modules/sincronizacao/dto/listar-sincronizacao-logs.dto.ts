import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export const SINCRONIZACAO_LOG_NIVEL_FILTRO = ['info', 'warn', 'error'] as const;

export class ListarSincronizacaoLogsDto {
  @ApiPropertyOptional({ example: 'inhumas' })
  @IsOptional()
  @IsString()
  agente?: string;

  @ApiPropertyOptional({
    description: 'Filtra por nível: info (sucesso), warn (alerta), error',
    enum: SINCRONIZACAO_LOG_NIVEL_FILTRO,
    example: 'info',
  })
  @IsOptional()
  @IsString()
  @IsIn([...SINCRONIZACAO_LOG_NIVEL_FILTRO])
  nivel?: (typeof SINCRONIZACAO_LOG_NIVEL_FILTRO)[number];

  @ApiPropertyOptional({ example: 200, default: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
