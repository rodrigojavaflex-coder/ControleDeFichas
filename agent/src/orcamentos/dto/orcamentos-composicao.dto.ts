import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class OrcamentosComposicaoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unit!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  nrorc!: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  serieo?: string;
}
