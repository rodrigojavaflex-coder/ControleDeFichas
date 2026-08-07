import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class ProducaoPainelLinhaDto {
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
  nomePrescritor: string | null;

  @ApiPropertyOptional()
  dataRetirada: string | null;

  @ApiPropertyOptional()
  horaRetirada: string | null;

  @ApiProperty()
  codEtapaAtual: string;

  @ApiProperty()
  etapaAtual: string;

  @ApiProperty()
  posicaoEtapaAtual: number;

  @ApiPropertyOptional({
    description: 'Minutos até retirada (corrido); negativo = atrasado',
  })
  minutosParaRetirada: number | null;

  @ApiProperty({ description: '#RRGGBB ou NEUTRO' })
  corPainel: string;

  @ApiPropertyOptional()
  rotuloAlerta: string | null;
}

export class ProducaoPainelAlertaLegendaDto {
  @ApiProperty({ description: '#RRGGBB ou NEUTRO' })
  cor: string;

  @ApiPropertyOptional()
  rotulo: string | null;
}

export class ProducaoPainelResponseDto {
  @ApiProperty({ type: [String], enum: Unidade, isArray: true })
  unidades: Unidade[];

  @ApiProperty()
  consultadoEm: string;

  @ApiProperty({ type: [ProducaoPainelLinhaDto] })
  linhas: ProducaoPainelLinhaDto[];

  @ApiProperty({ type: [ProducaoPainelAlertaLegendaDto] })
  legenda: ProducaoPainelAlertaLegendaDto[];
}
