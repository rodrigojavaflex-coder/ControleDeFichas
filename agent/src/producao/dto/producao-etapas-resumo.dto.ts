import {
  IsDateString,
  IsInt,
  IsOptional,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProducaoEtapasResumoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unit!: number;

  @ValidateIf((o) => !o.dataMinimaMovimento)
  @IsDateString()
  start?: string;

  @ValidateIf((o) => !o.dataMinimaMovimento)
  @IsDateString()
  end?: string;

  @ValidateIf((o) => !o.start && !o.end)
  @Matches(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/, {
    message:
      'dataMinimaMovimento deve estar no formato YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss',
  })
  dataMinimaMovimento?: string;
}
