import { IsDateString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class OrcamentosPeriodoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unit!: number;

  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;
}
