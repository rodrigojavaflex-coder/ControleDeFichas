import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';

export class FindUsersDto {
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
  name?: string;

  @ApiProperty({
    description: 'Buscar por email (parcial)',
    required: false,
    example: 'joao@email.com',
  })
  @IsOptional()
  @IsString()
  email?: string;
}