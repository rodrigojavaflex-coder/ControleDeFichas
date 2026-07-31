import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class AcompanhamentoEtapaResumoDto {
  @ApiProperty()
  codEtapa: string;

  @ApiProperty()
  etapa: string;

  @ApiProperty()
  posicaoEtapa: number;

  @ApiProperty({
    description:
      'Quantidade de pares requisição+fórmula em andamento nesta etapa',
  })
  totalRequisicoesFormulas: number;

  @ApiProperty({
    description:
      'Tempo médio em minutos (decorrido desde a entrada, fila em andamento)',
    nullable: true,
  })
  tempoMedioMinutos: number | null;
}

export class AcompanhamentoResumoResponseDto {
  @ApiProperty({ enum: Unidade, isArray: true })
  unidades: Unidade[];

  @ApiProperty({ type: [AcompanhamentoEtapaResumoDto] })
  etapas: AcompanhamentoEtapaResumoDto[];

  @ApiProperty({
    description: 'Momento da consulta (ISO) para referência do tempo decorrido',
  })
  consultadoEm: string;
}

export class AcompanhamentoLinhaFilaDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  filial: number;

  @ApiProperty()
  requisicao: number;

  @ApiProperty()
  formula: string;

  @ApiProperty({ nullable: true, description: 'cdusu ERP (entrada na etapa)' })
  usuarioEntrada: number | null;

  @ApiProperty({
    nullable: true,
    description:
      'Nome do funcionário (funcionarios.codigoUsuarioErp na unidade da linha)',
  })
  funcionario: string | null;

  @ApiProperty({ nullable: true })
  dataEntrada: string | null;

  @ApiProperty({ nullable: true })
  horaEntrada: string | null;

  @ApiProperty({
    description: 'Minutos desde a entrada até a consulta',
  })
  tempoDecorridoMinutos: number;

  @ApiProperty({ nullable: true })
  cliente: string | null;

  @ApiProperty({ nullable: true })
  paciente: string | null;

  @ApiProperty({ nullable: true })
  dataRetirada: string | null;
}

export class AcompanhamentoDetalheResponseDto {
  @ApiProperty()
  codEtapa: string;

  @ApiProperty()
  etapa: string;

  @ApiProperty()
  posicaoEtapa: number;

  @ApiProperty({ enum: Unidade, isArray: true })
  unidades: Unidade[];

  @ApiProperty({ type: [AcompanhamentoLinhaFilaDto] })
  linhas: AcompanhamentoLinhaFilaDto[];

  @ApiProperty()
  consultadoEm: string;
}

export class AcompanhamentoLocalizarResponseDto {
  @ApiProperty()
  codEtapa: string;

  @ApiProperty()
  etapa: string;

  @ApiProperty()
  posicaoEtapa: number;

  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  filial: number;

  @ApiProperty()
  requisicao: number;

  @ApiProperty()
  formula: string;
}
