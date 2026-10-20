import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class EditarValoresFechamentoDto {
  @ApiPropertyOptional({
    description: 'Valor de compra (V. Compra)',
    example: 101.6,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'valorCompra deve ser um número válido' },
  )
  @Min(0, { message: 'valorCompra deve ser maior ou igual a zero' })
  valorCompra?: number;

  @ApiPropertyOptional({
    description: 'Valor do fechamento (V. Fechamento / valorPago)',
    example: 66.04,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'valorPago deve ser um número válido' },
  )
  @Min(0, { message: 'valorPago deve ser maior ou igual a zero' })
  valorPago?: number;
}
