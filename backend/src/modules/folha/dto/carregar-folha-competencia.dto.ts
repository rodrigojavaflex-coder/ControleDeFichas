import { IsEnum, IsInt, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Unidade } from '../../../common/enums/unidade.enum';

/** Body de `POST …/folha/capas/carregar-competencia` (lista de capas da competência; RN-011). */
export class CarregarFolhaCompetenciaDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ minimum: 2000 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  ano: number;

  @ApiProperty({ minimum: 1, maximum: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  @ApiProperty()
  @IsUUID('4')
  folhaTipoId: string;
}
