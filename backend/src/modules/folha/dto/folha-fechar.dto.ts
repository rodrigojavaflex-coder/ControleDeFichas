import {
  IsEnum,
  IsInt,
  Max,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class FolhaFecharDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  @Type(() => Number)
  ano: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  mes: number;

  @ApiProperty()
  @IsUUID()
  folhaTipoId: string;
}
