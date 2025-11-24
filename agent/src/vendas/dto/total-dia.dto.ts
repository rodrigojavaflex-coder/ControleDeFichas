import { Type } from 'class-transformer';
import { IsInt, IsString, Matches } from 'class-validator';

export class TotalDiaDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @Type(() => Number)
  @IsInt()
  unit!: number;
}
