import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class FindMinhasVisitasDto {
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

  @ApiPropertyOptional({ example: '2026-01-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataFim?: string;

  @ApiPropertyOptional({
    enum: ['mais', 'menos'],
    description: 'Mais de X dias ou menos de X dias desde a visita',
  })
  @IsOptional()
  @IsIn(['mais', 'menos'])
  diasComparacao?: 'mais' | 'menos';

  @ApiPropertyOptional({ example: 5, description: 'Quantidade de dias da comparação' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3650)
  dias?: number;
}
