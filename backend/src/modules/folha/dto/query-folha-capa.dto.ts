import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class QueryFolhaCapaDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  @Type(() => Number)
  ano: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  mes: number;

  @ApiProperty()
  @IsUUID()
  folhaTipoId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  funcionarioId?: string;

  /**
   * Quando verdadeiro, inclui itens das capas e retorna `{ capa, totalReceitas, totalDespesas, liquido }[]`
   * (mesmo formato de `GET …/capas/:id/completa`).
   */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return false;
    return value === true || value === 'true' || value === '1';
  })
  @IsBoolean()
  comDetalhe?: boolean;
}
