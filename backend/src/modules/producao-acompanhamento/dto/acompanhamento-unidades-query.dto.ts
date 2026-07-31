import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, ValidateIf } from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export function toUnidadeArray(value: unknown): Unidade[] | undefined {
  if (Array.isArray(value)) {
    return value.map(String).filter((s) => s.trim() !== '') as Unidade[];
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return [value.trim() as Unidade];
  }
  return undefined;
}

/** Filtro de unidades (mesmo contrato da produtividade; sem período — só fila em andamento). */
export class AcompanhamentoUnidadesQueryDto {
  @ApiPropertyOptional({ enum: Unidade, isArray: true })
  @ValidateIf((o) => !o.unidade)
  @Transform(({ value }) => toUnidadeArray(value))
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos uma unidade.' })
  @IsEnum(Unidade, { each: true })
  unidades?: Unidade[];

  @ApiPropertyOptional({ enum: Unidade, deprecated: true })
  @ValidateIf((o) => !o.unidades?.length)
  @IsEnum(Unidade)
  unidade?: Unidade;
}
