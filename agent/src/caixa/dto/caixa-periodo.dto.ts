import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CaixaPeriodoDto {
  @Type(() => Number)
  @IsInt()
  unit!: number;

  @ValidateIf((o: CaixaPeriodoDto) => !o.start && !o.end)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date deve estar no formato YYYY-MM-DD',
  })
  date?: string;

  @ValidateIf((o: CaixaPeriodoDto) => !o.date)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'start deve estar no formato YYYY-MM-DD',
  })
  start?: string;

  @ValidateIf((o: CaixaPeriodoDto) => !o.date)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'end deve estar no formato YYYY-MM-DD',
  })
  end?: string;

  @IsOptional()
  @IsBoolean()
  filtrarFlagBaixa?: boolean;
}
