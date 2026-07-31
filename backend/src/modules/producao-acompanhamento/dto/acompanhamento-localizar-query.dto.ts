import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';
import { toUnidadeArray } from './acompanhamento-unidades-query.dto';

export class AcompanhamentoLocalizarQueryDto {
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

  @ApiProperty({ example: 96605 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requisicao: number;

  @ApiProperty({ example: '0' })
  @IsString()
  @Transform(({ value }) => String(value ?? '').trim())
  formula: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  filial?: number;
}
