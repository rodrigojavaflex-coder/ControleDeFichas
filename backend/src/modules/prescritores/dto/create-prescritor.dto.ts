import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsOptional,
  IsInt,
} from 'class-validator';
import { Transform } from 'class-transformer';

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
    required: false,
  })
  @IsOptional()
  @IsInt({ message: 'numeroCRM deve ser um número inteiro' })
  numeroCRM?: number;

  @ApiProperty({
    description: 'UF do CRM do prescritor',
    example: 'GO',
    maxLength: 2,
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'UFCRM deve ser uma string' })
  @MaxLength(2, { message: 'UFCRM não pode ter mais que 2 caracteres' })
  @Transform(({ value }) => (value === '' ? null : value))
  UFCRM?: string;
}

