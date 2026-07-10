import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Unidade } from '../../../common/enums/unidade.enum';

export class AtualizarSaldoInicialUnidadeDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ example: 255 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  saldoInicial: number;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString({}, { message: 'dataSaldo deve estar no formato YYYY-MM-DD' })
  dataSaldo: string;
}

export class CaixaSaldoInicialUnidadeDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  saldoInicial: number;

  @ApiProperty({ required: false, nullable: true, example: '2026-01-01' })
  dataSaldo?: string | null;
}
