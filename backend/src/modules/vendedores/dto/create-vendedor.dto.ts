import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
  IsEnum,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class CreateVendedorDto {
  @ApiProperty({
    description: 'Nome do vendedor',
    example: 'Maria Santos',
    maxLength: 500,
  })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @IsString({ message: 'Nome deve ser uma string' })
  @MaxLength(500, { message: 'Nome não pode ter mais que 500 caracteres' })
  nome: string;

  @ApiProperty({
    description: 'Código do vendedor no sistema de produção',
    example: 54321,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: 'cdVendedor deve ser um número inteiro' })
  cdVendedor?: number;

  @ApiProperty({
    description: 'Unidade do vendedor',
    example: Unidade.INHUMAS,
    enum: Unidade,
  })
  @IsNotEmpty({ message: 'Unidade é obrigatória' })
  @IsEnum(Unidade, { message: 'Unidade deve ser um valor válido (INHUMAS, NERÓPOLIS, UBERABA)' })
  unidade: Unidade;
}

