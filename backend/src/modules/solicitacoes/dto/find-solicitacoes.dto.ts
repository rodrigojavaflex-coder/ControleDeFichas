import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { StatusSolicitacao } from '../enums/status-solicitacao.enum';

const STATUS_FILTRO = [...Object.values(StatusSolicitacao), 'todas'] as const;

export class FindSolicitacoesDto {
  @ApiPropertyOptional({
    enum: STATUS_FILTRO,
    description: 'Sem filtro = todas. Use um status específico ou todas.',
  })
  @IsOptional()
  @IsIn([...STATUS_FILTRO], {
    message: 'Situação da pendência inválida.',
  })
  status?: StatusSolicitacao | 'todas';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: 'Médico inválido.' })
  prescritorId?: string;

  @ApiPropertyOptional({ description: 'Filtrar pelo tipo de pendência' })
  @IsOptional()
  @IsUUID('4', { message: 'Tipo de pendência inválido.' })
  tipoPendenciaId?: string;

  @ApiPropertyOptional({ enum: ['todos', 'no_painel', 'fora_painel'] })
  @IsOptional()
  @IsIn(['todos', 'no_painel', 'fora_painel'])
  filtroPainel?: 'todos' | 'no_painel' | 'fora_painel';

  @ApiPropertyOptional({ enum: ['ano', 'mes', 'personalizado'] })
  @IsOptional()
  @IsIn(['ano', 'mes', 'personalizado'])
  periodo?: 'ano' | 'mes' | 'personalizado';

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  ano?: number;

  @ApiPropertyOptional({ example: 11 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataInicio?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataFim?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
