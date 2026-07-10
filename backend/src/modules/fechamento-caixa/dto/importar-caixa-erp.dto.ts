import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum } from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class ImportarCaixaErpDto {
  @ApiProperty({
    description: 'Unidade de negócio (mapeia para agente e cdfil)',
    enum: Unidade,
    example: Unidade.INHUMAS,
  })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({
    description: 'Data inicial do caixa (YYYY-MM-DD) — deve ser igual a dataFim (um dia por busca)',
    example: '2025-10-01',
  })
  @IsDateString({}, { message: 'dataInicio deve estar no formato YYYY-MM-DD' })
  dataInicio: string;

  @ApiProperty({
    description: 'Data final do caixa (YYYY-MM-DD) — deve ser igual a dataInicio (um dia por busca)',
    example: '2025-10-01',
  })
  @IsDateString({}, { message: 'dataFim deve estar no formato YYYY-MM-DD' })
  dataFim: string;
}
