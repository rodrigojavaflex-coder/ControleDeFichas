import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum } from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class CalendarioUnidadeResponseDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  sabadoDiaUtil: boolean;
}

export class SalvarCalendarioUnidadeDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty()
  @IsBoolean()
  sabadoDiaUtil: boolean;
}
