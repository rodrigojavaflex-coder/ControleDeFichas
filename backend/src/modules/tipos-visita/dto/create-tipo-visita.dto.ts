import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Unidade } from '../../../common/enums/unidade.enum';

export class CreateTipoVisitaDto {
  @ApiProperty({ example: 'Apresentação', maxLength: 80 })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  @IsString({ message: 'Nome deve ser um texto' })
  @MinLength(1, { message: 'Nome é obrigatório' })
  @MaxLength(80, { message: 'Nome não pode ter mais que 80 caracteres' })
  nome: string;

  @ApiProperty({ enum: Unidade })
  @IsIn(Object.values(Unidade), { message: 'Unidade inválida.' })
  unidade: Unidade;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: 'Ativo deve ser verdadeiro ou falso' })
  ativo?: boolean;
}
