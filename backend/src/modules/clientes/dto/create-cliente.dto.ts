import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsEmail,
  IsDateString,
  IsInt,
  IsEnum,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Unidade } from '../../../common/enums/unidade.enum';

export class CreateClienteDto {
  @ApiProperty({
    description: 'Nome do cliente',
    example: 'João da Silva',
    maxLength: 500,
  })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @IsString({ message: 'Nome deve ser uma string' })
  @MaxLength(500, { message: 'Nome não pode ter mais que 500 caracteres' })
  nome: string;

  @ApiProperty({
    description: 'Código do cliente no sistema de produção',
    example: 12345,
    required: false,
  })
  @IsOptional()
  @IsInt({ message: 'cdcliente deve ser um número inteiro' })
  cdcliente?: number;

  @ApiProperty({
    description: 'CPF do cliente',
    example: '123.456.789-00',
    maxLength: 14,
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'CPF deve ser uma string' })
  @MaxLength(14, { message: 'CPF não pode ter mais que 14 caracteres' })
  @Matches(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/, {
    message: 'CPF deve estar no formato 123.456.789-00 ou 12345678900',
  })
  @Transform(({ value }) => (value === '' ? null : value))
  cpf?: string;

  @ApiProperty({
    description: 'Data de nascimento do cliente',
    example: '1980-05-15',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data de nascimento deve estar no formato YYYY-MM-DD' })
  @Transform(({ value }) => (value === '' ? null : value))
  dataNascimento?: string;

  @ApiProperty({
    description: 'Email do cliente',
    example: 'joao@email.com',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: 'Email deve ter formato válido' })
  @MaxLength(255, { message: 'Email não pode ter mais que 255 caracteres' })
  @Transform(({ value }) => (value === '' ? null : value))
  email?: string;

  @ApiProperty({
    description: 'Telefone do cliente',
    example: '(62) 99999-9999',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Telefone deve ser uma string' })
  @MaxLength(20, { message: 'Telefone não pode ter mais que 20 caracteres' })
  @Transform(({ value }) => (value === '' ? null : value))
  telefone?: string;

  @ApiProperty({
    description: 'Unidade do cliente',
    example: Unidade.INHUMAS,
    enum: Unidade,
  })
  @IsNotEmpty({ message: 'Unidade é obrigatória' })
  @IsEnum(Unidade, { message: 'Unidade deve ser um valor válido (INHUMAS, NERÓPOLIS, UBERABA)' })
  unidade: Unidade;
}

