import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';
import {
  COMERCIAL_ANALISE_BASES,
  COMERCIAL_ANALISE_DIMENSOES,
  COMERCIAL_ANALISE_LEITURAS,
  COMERCIAL_ANALISE_METRICAS,
  COMERCIAL_ANALISE_MODOS,
} from './find-comercial-analise.dto';
import type {
  ComercialAnaliseBase,
  ComercialAnaliseDimensao,
  ComercialAnaliseLeitura,
  ComercialAnaliseMetrica,
  ComercialAnaliseModo,
} from './find-comercial-analise.dto';

export class ComercialAnalisePeriodoDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  labelCurto: string;

  @ApiProperty()
  previa: boolean;

  @ApiProperty({ example: '2026-10-01' })
  inicio: string;

  @ApiProperty({ example: '2026-10-31' })
  fim: string;
}

export class ComercialAnaliseVendedorOpcaoDto {
  @ApiProperty()
  funcionarioId: string;

  @ApiProperty()
  nome: string;

  @ApiProperty()
  codigoVendedorErp: number;
}

export class ComercialAnaliseOpcoesResponseDto {
  @ApiPropertyOptional({
    enum: Unidade,
    nullable: true,
    description: 'Unidade resolvida (escopo fixo ou filtro). Null se gestão sem filtro.',
  })
  unidade: Unidade | null;

  @ApiProperty({
    enum: Unidade,
    isArray: true,
    description: 'Unidades que o usuário pode marcar (escopo).',
  })
  unidadesDisponiveis: Unidade[];

  @ApiProperty({
    description: 'True quando usuario.unidade (ou vendedor) trava o filtro.',
  })
  escopoFixo: boolean;

  @ApiProperty({ example: 2026 })
  anoCorrente: number;

  @ApiProperty({ type: [ComercialAnalisePeriodoDto] })
  competencias: ComercialAnalisePeriodoDto[];

  @ApiProperty({
    type: [ComercialAnalisePeriodoDto],
    description: 'Semanas do mês corrente (segunda–domingo, cortadas no mês).',
  })
  semanas: ComercialAnalisePeriodoDto[];

  @ApiProperty({ type: [ComercialAnaliseVendedorOpcaoDto] })
  vendedores: ComercialAnaliseVendedorOpcaoDto[];
}

export class ComercialAnaliseLinhaDto {
  @ApiProperty()
  funcionarioId: string;

  @ApiProperty()
  nomeVendedor: string;

  @ApiProperty()
  codigoVendedorErp: number;

  @ApiPropertyOptional({ nullable: true })
  valorMes1: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorMes2: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorPeriodo: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Total ÷ N. Null para ticket médio.',
  })
  valorMedia: number | null;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Série na métrica. Null no ticket quando a quantidade é 0.',
  })
  serie?: Array<number | null>;

  @ApiProperty()
  delta: number;

  @ApiPropertyOptional({ nullable: true })
  percentual: number | null;
}

export class ComercialAnaliseFiltrosAplicadosDto {
  @ApiProperty({ enum: COMERCIAL_ANALISE_DIMENSOES })
  dimensao: ComercialAnaliseDimensao;

  @ApiProperty({
    enum: Unidade,
    isArray: true,
    description: 'Unidades efetivas da grade (1 em vendedor; N em dimensao=unidade).',
  })
  unidades: Unidade[];

  @ApiProperty({
    type: [String],
    description:
      'Vendedores marcados (só dimensao=vendedor; vazio = nenhum).',
  })
  funcionarioIds: string[];

  @ApiProperty({ enum: COMERCIAL_ANALISE_METRICAS })
  metrica: ComercialAnaliseMetrica;

  @ApiProperty({ enum: COMERCIAL_ANALISE_BASES })
  base: ComercialAnaliseBase;

  @ApiPropertyOptional({ enum: COMERCIAL_ANALISE_LEITURAS, nullable: true })
  leitura: ComercialAnaliseLeitura | null;
}

export class ComercialAnaliseResponseDto {
  @ApiPropertyOptional({
    enum: Unidade,
    nullable: true,
    description: 'Primeira unidade do recorte (compat). Preferir filtrosAplicados.unidades.',
  })
  unidade: Unidade | null;

  @ApiProperty({ enum: COMERCIAL_ANALISE_MODOS })
  modo: ComercialAnaliseModo;

  @ApiProperty({ type: [ComercialAnalisePeriodoDto] })
  periodos: ComercialAnalisePeriodoDto[];

  @ApiPropertyOptional({ type: ComercialAnalisePeriodoDto, nullable: true })
  periodo1: ComercialAnalisePeriodoDto | null;

  @ApiPropertyOptional({ type: ComercialAnalisePeriodoDto, nullable: true })
  periodo2: ComercialAnalisePeriodoDto | null;

  @ApiPropertyOptional({ enum: ['soma'], nullable: true })
  agregacao: 'soma' | null;

  @ApiProperty({ type: ComercialAnaliseFiltrosAplicadosDto })
  filtrosAplicados: ComercialAnaliseFiltrosAplicadosDto;

  @ApiProperty({ type: [ComercialAnaliseLinhaDto] })
  crescimento: ComercialAnaliseLinhaDto[];

  @ApiProperty({ type: [ComercialAnaliseLinhaDto] })
  queda: ComercialAnaliseLinhaDto[];

  @ApiProperty({ type: [ComercialAnaliseLinhaDto] })
  maioresVendas: ComercialAnaliseLinhaDto[];

  @ApiProperty({ type: [ComercialAnaliseLinhaDto] })
  maioresRejeitados: ComercialAnaliseLinhaDto[];
}
