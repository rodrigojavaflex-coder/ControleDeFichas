import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  IsEnum,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class FindClientesDto {
  @ApiProperty({
    minimum: 1,
    default: 1,
    description: 'Número da página',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    minimum: 1,
    maximum: 100,
    default: 10,
    description: 'Quantidade de itens por página',
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    description: 'Buscar por nome (parcial)',
    required: false,
    example: 'João',
  })
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiProperty({
    description: 'Buscar por CPF',
    required: false,
    example: '123.456.789-00',
  })
  @IsOptional()
  @IsString()
  cpf?: string;

  @ApiProperty({
    description: 'Filtrar por unidade',
    enum: Unidade,
    required: false,
  })
  @IsOptional()
  @IsEnum(Unidade, { message: 'Unidade deve ser um valor válido' })
  unidade?: Unidade;
}

