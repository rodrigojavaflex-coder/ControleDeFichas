import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum } from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class ImportarOrcamentosDto {
  @ApiProperty({ enum: Unidade, example: Unidade.INHUMAS })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  dataInicio: string;

  @ApiProperty({ example: '2026-06-30' })
  @IsDateString()
  dataFim: string;
}

export class ImportarOrcamentosResponseDto {
  @ApiProperty()
  unidade: Unidade;

  @ApiProperty()
  processados: number;

  @ApiProperty()
  criados: number;

  @ApiProperty()
  atualizados: number;

  @ApiProperty({
    description:
      'Orçamentos removidos do PostgreSQL após exclusão confirmada no ERP (FC01M20 / FC15100 ausente)',
  })
  removidos: number;

  @ApiProperty({ type: [String] })
  erros: string[];
}
