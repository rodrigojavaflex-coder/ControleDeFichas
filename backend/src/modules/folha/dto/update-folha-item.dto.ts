import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFolhaItemDto {
  @ApiProperty({ example: 1600, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valor?: number;

  @ApiProperty({ example: 1.5, required: false, description: 'Referência / quantidade' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantidade?: number;
}
