import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
  IsInt,
} from 'class-validator';

export class FindPrescritoresDto {
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
    description: 'Buscar por número do CRM',
    required: false,
    example: 12345,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  numeroCRM?: number;
}

