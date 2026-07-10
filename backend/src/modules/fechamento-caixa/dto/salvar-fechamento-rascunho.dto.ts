import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Unidade } from '../../../common/enums/unidade.enum';

export class SalvarFechamentoRascunhoDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ example: '2025-10-01' })
  @IsDateString({}, { message: 'data deve estar no formato YYYY-MM-DD' })
  data: string;

  @ApiProperty({ example: 260 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalDespesas: number;

  @ApiProperty({ example: 200 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  totalRetirada: number;
}
