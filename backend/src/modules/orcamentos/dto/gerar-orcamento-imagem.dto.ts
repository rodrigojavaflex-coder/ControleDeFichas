import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class GerarOrcamentoImagemDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ example: 102178 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  nrorc: number;

  @ApiPropertyOptional({
    description: 'Série da fórmula. Vazio gera todas as fórmulas do número.',
    example: '0',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  @Transform(({ value }) => {
    if (value == null) {
      return undefined;
    }
    const texto = String(value).trim();
    return texto === '' ? undefined : texto;
  })
  serieo?: string;

  @ApiProperty({ example: 5, description: 'Dias de validade impressos na imagem' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  diasValidade: number;
}

export class OrcamentoImagemAtivoDto {
  @ApiProperty()
  descricao: string;

  @ApiProperty()
  quantidade: number;

  @ApiProperty()
  unidade: string;

  @ApiProperty()
  linha: string;
}

export class OrcamentoImagemFormulaDto {
  @ApiProperty()
  serieo: string;

  @ApiProperty({ type: [OrcamentoImagemAtivoDto] })
  ativos: OrcamentoImagemAtivoDto[];

  @ApiProperty()
  embalagem: string;

  @ApiProperty()
  valor: number;
}

export class OrcamentoImagemResponseDto {
  @ApiProperty()
  paciente: string;

  @ApiProperty()
  cdfil: number;

  @ApiProperty()
  nrorc: number;

  @ApiProperty({ example: '2-102178' })
  numero: string;

  @ApiProperty({ type: [OrcamentoImagemFormulaDto] })
  formulas: OrcamentoImagemFormulaDto[];

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  desconto: number;

  @ApiProperty()
  total: number;

  @ApiProperty({ example: '25/11/2026' })
  geradoEm: string;

  @ApiProperty()
  diasValidade: number;
}
