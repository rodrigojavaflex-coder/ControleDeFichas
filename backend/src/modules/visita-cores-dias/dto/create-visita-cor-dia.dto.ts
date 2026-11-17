import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class CreateVisitaCorDiaDto {
  @ApiProperty({
    example: 5,
    description: 'Mais de N dias. Ex.: 5 colore a partir de 6 dias.',
  })
  @Type(() => Number)
  @IsInt({ message: 'Informe a quantidade de dias.' })
  @Min(0, { message: 'A quantidade de dias não pode ser negativa.' })
  @Max(3650, { message: 'A quantidade de dias não pode passar de 3650.' })
  diasAcimaDe: number;

  @ApiProperty({ example: '#F5C518' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString({ message: 'Informe a cor.' })
  @Matches(/^#[0-9A-F]{6}$/, {
    message: 'A cor deve estar no formato #RRGGBB.',
  })
  cor: string;

  @ApiProperty({ enum: Unidade })
  @IsIn(Object.values(Unidade), { message: 'Unidade inválida.' })
  unidade: Unidade;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: 'Ativo deve ser verdadeiro ou falso.' })
  ativo?: boolean;
}
