import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsString,
  Matches,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class LimparProducaoEtapasAntigasDto {
  @ApiProperty({ enum: Unidade, example: Unidade.INHUMAS })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({
    example: '2026-06-30',
    description:
      'Data limite (YYYY-MM-DD). Remove registros com entrada/fila igual ou anterior a esta data.',
  })
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'dataLimite deve estar no formato YYYY-MM-DD',
  })
  dataLimite: string;

  @ApiProperty({
    type: [String],
    example: ['ROT01', 'ROT02'],
    description:
      'Códigos das etapas que definem o fim da produção (codEtapa). Fórmulas sem saída nessas etapas são removidas por completo.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  etapasFinais: string[];
}

export class ProducaoEtapaDisponivelDto {
  @ApiProperty()
  codEtapa: string;

  @ApiProperty()
  etapa: string;

  @ApiProperty()
  posicaoEtapa: number;
}

export class FormulaAmostraLimpezaDto {
  @ApiProperty()
  filial: number;

  @ApiProperty()
  requisicao: number;

  @ApiProperty()
  formula: string;

  @ApiPropertyOptional({ nullable: true })
  minDataEntrada?: string | null;
}

export class LimparProducaoEtapasAntigasResponseDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  dataLimite: string;

  @ApiProperty({ type: [String] })
  etapasFinais: string[];

  @ApiProperty({
    description:
      'Linhas com dataEntrada <= limite, sem dataSaida (regra abertos)',
  })
  linhasAbertos: number;

  @ApiProperty({
    description:
      'Linhas em fila com dataEntradaFila <= limite (regra fila operacional)',
  })
  linhasFila: number;

  @ApiProperty({
    description:
      'Quantidade de req-fórmulas sem saída nas etapas finais (regra painel)',
  })
  formulasSemFim: number;

  @ApiProperty({
    description:
      'Linhas pertencentes às fórmulas sem fim (serão/foram apagadas pela regra 3)',
  })
  linhasFormulasSemFim: number;

  @ApiProperty({
    description: 'Total de linhas afetadas pelas três regras (união aproximada no preview; no execute = somatório dos deletes)',
  })
  totalLinhas: number;

  @ApiProperty({ type: [FormulaAmostraLimpezaDto] })
  amostraFormulasSemFim: FormulaAmostraLimpezaDto[];

  @ApiPropertyOptional({
    description: 'Presente apenas na execução (não no preview)',
  })
  executado?: boolean;
}

export class ListarFormulasSemFimLimpezaResponseDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  dataLimite: string;

  @ApiProperty({ type: [String] })
  etapasFinais: string[];

  @ApiProperty()
  total: number;

  @ApiProperty({ type: [FormulaAmostraLimpezaDto] })
  formulas: FormulaAmostraLimpezaDto[];
}
