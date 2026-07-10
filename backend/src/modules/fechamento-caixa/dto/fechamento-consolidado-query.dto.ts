import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum } from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class FechamentoConsolidadoQueryDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ example: '2025-10-01' })
  @IsDateString({}, { message: 'data deve estar no formato YYYY-MM-DD' })
  data: string;
}
