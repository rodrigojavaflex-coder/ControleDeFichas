import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  IsInt,
  IsEnum,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Unidade } from '../../../common/enums/unidade.enum';

export class CreatePrescritorDto {
  @ApiProperty({
    description: 'Nome do prescritor',
    example: 'Dr. João Almeida',
    maxLength: 500,
  })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @IsString({ message: 'Nome deve ser uma string' })
  @MaxLength(500, { message: 'Nome não pode ter mais que 500 caracteres' })
  nome: string;

  @ApiProperty({
    description: 'Número do CRM do prescritor',
    example: 12345,
  })
  @IsNotEmpty({ message: 'Número do CRM é obrigatório' })
  @IsInt({ message: 'numeroCRM deve ser um número inteiro' })
  @Min(1, { message: 'Número do CRM deve ser maior que zero' })
  numeroCRM: number;

  @ApiProperty({
    description: 'UF do CRM do prescritor',
    example: 'GO',
    maxLength: 2,
  })
  @IsNotEmpty({ message: 'UF do CRM é obrigatória' })
  @IsString({ message: 'UFCRM deve ser uma string' })
  @MinLength(2, { message: 'UF do CRM deve ter 2 caracteres' })
  @MaxLength(2, { message: 'UFCRM não pode ter mais que 2 caracteres' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  UFCRM: string;

  @ApiProperty({
    description: 'Profissão / PFCRM do ERP (1=MEDICO, 6=NUTRICIONISTA, …)',
    example: '1',
    maxLength: 3,
    required: false,
    default: '1',
  })
  @IsOptional()
  @IsString({ message: 'pfcrm deve ser uma string' })
  @MaxLength(3, { message: 'pfcrm não pode ter mais que 3 caracteres' })
  @Transform(({ value }) => {
    if (value == null || value === '') return undefined;
    return String(value).trim().toUpperCase();
  })
  pfcrm?: string;

  @ApiProperty({
    enum: Unidade,
    description: 'Unidade dona do cadastro',
  })
  @IsNotEmpty({ message: 'Unidade é obrigatória' })
  @IsEnum(Unidade, { message: 'Unidade inválida' })
  unidade: Unidade;
}
