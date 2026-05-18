import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class FuncionarioEventoFixoLinhaDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  folhaVerbaId: string;

  @ApiPropertyOptional({
    description: 'Referência / quantidade (> 0). Padrão 1.',
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  quantidade?: number;

  @ApiProperty({ description: 'Valor monetário do lançamento' })
  @IsNumber()
  @Type(() => Number)
  valor: number;
}