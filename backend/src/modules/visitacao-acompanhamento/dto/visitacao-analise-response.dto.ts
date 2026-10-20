import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';
import { VisitacaoPainelMedicoRepresentanteDto } from '../../visitacao-painel-medico/dto/visitacao-painel-medico-representante.dto';
import { NA_CARTEIRA_FILTRO } from './find-visitacao-acompanhamento.dto';
import { VISITACAO_ANALISE_MODOS } from './find-visitacao-analise.dto';
import type { VisitacaoAnaliseModo } from './find-visitacao-analise.dto';

export class VisitacaoAnaliseCompetenciaDto {
  @ApiProperty({ example: '2025-12', description: 'Chave YYYY-MM' })
  key: string;

  @ApiProperty({ example: 2025 })
  ano: number;

  @ApiProperty({ minimum: 1, maximum: 12 })
  mes: number;

  @ApiProperty({ enum: ['FECHADO'], example: 'FECHADO' })
  fonte: 'FECHADO';

  @ApiProperty({ example: 'Dezembro/2025' })
  label: string;
}

export class VisitacaoAnaliseOpcoesResponseDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty({
    type: [VisitacaoAnaliseCompetenciaDto],
    description: 'Competências fechadas da unidade (todos os anos), ordem cronológica.',
  })
  competenciasDisponiveis: VisitacaoAnaliseCompetenciaDto[];

  @ApiProperty({ type: [VisitacaoPainelMedicoRepresentanteDto] })
  representantes: VisitacaoPainelMedicoRepresentanteDto[];

  @ApiPropertyOptional({
    type: () => VisitacaoAnaliseResponseDto,
    nullable: true,
    description:
      'Preenchido quando comAnalise=true e há ≥2 competências fechadas (últimas duas, modo comparar).',
  })
  analise?: VisitacaoAnaliseResponseDto | null;
}

export class VisitacaoAnaliseMedicoDto {
  @ApiProperty()
  crmMedico: string;

  @ApiProperty()
  ufCrmMedico: string;

  @ApiProperty()
  nomeMedico: string;

  @ApiPropertyOptional({ nullable: true })
  nomeRepresentante: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Valor total na competência 1 (modo comparar).',
  })
  valorMes1: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Valor total na competência 2 (modo comparar).',
  })
  valorMes2: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Total do período (modo ranking).',
  })
  valorPeriodo: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Média mensal do período (modo ranking): valorPeriodo ÷ quantidade de competências.',
  })
  valorMedia: number | null;

  @ApiPropertyOptional({
    type: [Number],
    description:
      'Série por competência (modo evolucao), na mesma ordem de `competencias`. Ausente nos demais modos.',
  })
  serie?: number[];

  @ApiProperty({
    description:
      'Modo comparar: valorMes2 − valorMes1. Ranking/evolução: 0 (não aplicável).',
  })
  delta: number;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Modo comparar: delta / valorMes1 * 100. Ranking/evolução: null.',
  })
  percentual: number | null;
}

export class VisitacaoAnaliseFiltrosAplicadosDto {
  @ApiPropertyOptional({ nullable: true })
  funcionarioId: string | null;

  @ApiPropertyOptional({ nullable: true })
  nomeMedico: string | null;

  @ApiProperty({ enum: ['todos', 'sim', 'nao'] })
  naCarteira: (typeof NA_CARTEIRA_FILTRO)[number];
}

export class VisitacaoAnaliseResponseDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty({ enum: VISITACAO_ANALISE_MODOS })
  modo: VisitacaoAnaliseModo;

  @ApiProperty({
    type: [VisitacaoAnaliseCompetenciaDto],
    description:
      'Competências do recorte. Comparar: [c1, c2]. Ranking/evolução: selecionadas.',
  })
  competencias: VisitacaoAnaliseCompetenciaDto[];

  @ApiPropertyOptional({
    type: VisitacaoAnaliseCompetenciaDto,
    nullable: true,
    description: 'Competência base (modo comparar).',
  })
  competencia1: VisitacaoAnaliseCompetenciaDto | null;

  @ApiPropertyOptional({
    type: VisitacaoAnaliseCompetenciaDto,
    nullable: true,
    description: 'Competência referência (modo comparar).',
  })
  competencia2: VisitacaoAnaliseCompetenciaDto | null;

  @ApiPropertyOptional({
    enum: ['soma'],
    nullable: true,
    description:
      'Agregação do período (ranking/evolução = soma/total). Null no comparar.',
  })
  agregacao: 'soma' | null;

  @ApiProperty({ type: VisitacaoAnaliseFiltrosAplicadosDto })
  filtrosAplicados: VisitacaoAnaliseFiltrosAplicadosDto;

  @ApiProperty({
    type: [VisitacaoAnaliseMedicoDto],
    description: 'Maior crescimento (modo comparar). Vazio nos demais.',
  })
  crescimento: VisitacaoAnaliseMedicoDto[];

  @ApiProperty({
    type: [VisitacaoAnaliseMedicoDto],
    description: 'Maior queda (modo comparar). Vazio nos demais.',
  })
  queda: VisitacaoAnaliseMedicoDto[];

  @ApiProperty({
    type: [VisitacaoAnaliseMedicoDto],
    description:
      'Recebido: ranking = total; evolução = série + total. Vazio no comparar.',
  })
  maioresVendas: VisitacaoAnaliseMedicoDto[];

  @ApiProperty({
    type: [VisitacaoAnaliseMedicoDto],
    description:
      'Rejeitados: comparar = Δ; ranking = total; evolução = série + total.',
  })
  maioresRejeitados: VisitacaoAnaliseMedicoDto[];
}
