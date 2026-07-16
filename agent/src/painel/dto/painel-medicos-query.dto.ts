import { IsInt, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PainelMedicosQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cdcon!: number;

  @IsString()
  @Matches(/^\d+(\s*,\s*\d+)*$/, {
    message: 'cdfun deve ser uma lista de números separados por vírgula (ex.: 1,2)',
  })
  cdfun!: string;
}
