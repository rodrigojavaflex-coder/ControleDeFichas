import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ProducaoConfigUnidadeQueryDto } from './producao-config-unidade-query.dto';

export class ProducaoFeriadosQueryDto extends ProducaoConfigUnidadeQueryDto {
  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  ano: number;

  @ApiPropertyOptional({ example: 8, description: 'Se omitido, retorna o ano inteiro' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;
}
