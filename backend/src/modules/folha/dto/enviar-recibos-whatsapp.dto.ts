import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsUUID, Max, Min } from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class EnviarRecibosWhatsappDto {
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
