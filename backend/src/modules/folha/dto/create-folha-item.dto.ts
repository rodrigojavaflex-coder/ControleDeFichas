import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFolhaItemDto {
  @ApiProperty()
  @IsUUID()
  folhaVerbaId: string;

  @ApiProperty({ example: 1500 })
  @Type(() => Number)
  @IsNumber()
  valor: number;

  @ApiProperty({
    example: 1,
    required: false,
    description: 'Referência / quantidade (padrão 1)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantidade?: number;
}
