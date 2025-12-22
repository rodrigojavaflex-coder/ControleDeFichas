import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

export class ValorCompraDto {
  @Type(() => Number)
  @IsInt()
  unit!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  protocolos!: number[];
}

