import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

function toUnidadeArray(value: unknown): Unidade[] | undefined {
  if (Array.isArray(value)) {
    return value.map(String).filter((s) => s.trim() !== '') as Unidade[];
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return [value.trim() as Unidade];
  }
  return undefined;
}

export class ProdutividadeQueryDto {
  @ApiPropertyOptional({
    enum: Unidade,
    isArray: true,
    description:
      'Uma ou mais unidades. Usuário com unidade vinculada consulta apenas a própria.',
  })
  @ValidateIf((o) => !o.unidade)
  @Transform(({ value }) => toUnidadeArray(value))
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos uma unidade.' })
  @IsEnum(Unidade, { each: true })
  unidades?: Unidade[];

  /** @deprecated Preferir `unidades`. Mantido para compatibilidade. */
  @ApiPropertyOptional({ enum: Unidade, deprecated: true })
  @ValidateIf((o) => !o.unidades?.length)
  @IsEnum(Unidade)
  unidade?: Unidade;

  @ApiProperty({ example: '2026-07-01' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dataInicio deve estar no formato YYYY-MM-DD',
  })
  dataInicio: string;

  @ApiProperty({ example: '2026-07-31' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dataFim deve estar no formato YYYY-MM-DD',
  })
  dataFim: string;
}
