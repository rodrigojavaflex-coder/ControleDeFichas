import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsString, MaxLength, Min } from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class ProducaoPainelHistoricoQueryDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  filial: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  requisicao: number;

  @ApiProperty()
  @IsString()
  @MaxLength(10)
  formula: string;
}

export class ProducaoPainelHistoricoEtapaDto {
  @ApiProperty()
  posicaoEtapa: number;

  @ApiProperty()
  codEtapa: string;

  @ApiProperty()
  etapa: string;

  @ApiPropertyOptional()
  dataEntrada: string | null;

  @ApiPropertyOptional()
  horaEntrada: string | null;

  @ApiPropertyOptional()
  funcionarioEntrada: string | null;

  @ApiPropertyOptional()
  dataSaida: string | null;

  @ApiPropertyOptional()
  horaSaida: string | null;

  @ApiPropertyOptional()
  funcionarioSaida: string | null;

  @ApiPropertyOptional({ description: 'Tempo na etapa (minutos), conforme resumo importado' })
  tempoEtapaMinutos: number | null;

  @ApiProperty()
  emAndamentoFila: boolean;

  @ApiPropertyOptional()
  dataEntradaFila: string | null;

  @ApiPropertyOptional()
  horaEntradaFila: string | null;

  @ApiPropertyOptional()
  funcionarioFila: string | null;
}

export class ProducaoPainelHistoricoResponseDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  filial: number;

  @ApiProperty()
  requisicao: number;

  @ApiProperty()
  formula: string;

  @ApiPropertyOptional()
  cliente: string | null;

  @ApiPropertyOptional()
  paciente: string | null;

  @ApiPropertyOptional()
  dataRetirada: string | null;

  @ApiPropertyOptional()
  horaRetirada: string | null;

  @ApiProperty()
  consultadoEm: string;

  @ApiProperty({ type: [ProducaoPainelHistoricoEtapaDto] })
  etapas: ProducaoPainelHistoricoEtapaDto[];
}
