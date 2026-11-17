import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Unidade } from '../../../common/enums/unidade.enum';

function texto(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.trim().replace(/\s+/g, ' ');
}

export class CreateTipoPendenciaDto {
  @ApiProperty({ example: 'Contato médico', maxLength: 80 })
  @Transform(({ value }) => texto(value))
  @IsString({ message: 'Nome deve ser um texto' })
  @MinLength(1, { message: 'Nome é obrigatório' })
  @MaxLength(80, { message: 'Nome não pode ter mais que 80 caracteres' })
  nome: string;

  @ApiProperty({ example: 'Ligação ou retorno ao prescritor' })
  @Transform(({ value }) => texto(value))
  @IsString({ message: 'Descrição deve ser um texto' })
  @MinLength(1, { message: 'Descrição é obrigatória' })
  @MaxLength(2000, { message: 'Descrição não pode ter mais que 2000 caracteres' })
  descricao: string;

  @ApiProperty({ enum: Unidade })
  @IsIn(Object.values(Unidade), { message: 'Unidade inválida.' })
  unidade: Unidade;

  @ApiProperty({ description: 'Usuário responsável de referência pelo tipo' })
  @IsUUID('4', { message: 'Responsável inválido.' })
  responsavelId: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean({ message: 'Ativo deve ser verdadeiro ou falso' })
  ativo?: boolean;
}
