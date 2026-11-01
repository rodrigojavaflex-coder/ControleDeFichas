import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';
import { parseCompetenciaKey } from '../comercial-analise-periodo.util';

export const COMERCIAL_ANALISE_MODOS = [
  'comparar',
  'ranking',
  'evolucao',
  'semanas',
] as const;
export type ComercialAnaliseModo = (typeof COMERCIAL_ANALISE_MODOS)[number];

export const COMERCIAL_ANALISE_METRICAS = [
  'valor',
  'quantidade',
  'ticketMedio',
] as const;
export type ComercialAnaliseMetrica =
  (typeof COMERCIAL_ANALISE_METRICAS)[number];

/** Mesmas parcelas do RESULTADOS do card (RN-COM-003 / RN-COM-009). */
export const COMERCIAL_ANALISE_BASES = [
  'manipuladosRequisicoes',
  'manipuladosSetor',
  'manipuladosTerceiros',
  'manipulados',
  'marcaPropriaSetores',
  'marcaPropriaOutros',
  'marcaPropria',
  'totalVendido',
] as const;
export type ComercialAnaliseBase = (typeof COMERCIAL_ANALISE_BASES)[number];

export const COMERCIAL_ANALISE_LEITURAS = ['comparar', 'evolucao'] as const;
export type ComercialAnaliseLeitura =
  (typeof COMERCIAL_ANALISE_LEITURAS)[number];

/** Vendedor = linhas de funcionário; Unidade = só o TOTAL da loja (análises separadas). */
export const COMERCIAL_ANALISE_DIMENSOES = ['vendedor', 'unidade'] as const;
export type ComercialAnaliseDimensao =
  (typeof COMERCIAL_ANALISE_DIMENSOES)[number];

const COMPETENCIA_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const SEMANA_KEY_REGEX = /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/;

function toCompetencias(value: unknown): string[] | undefined {
  if (value == null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const map = new Map<string, string>();
  for (const item of raw) {
    const parsed = parseCompetenciaKey(item);
    if (parsed) map.set(parsed.key, parsed.key);
  }
  return [...map.values()].sort();
}

export class FindComercialAnaliseOpcoesDto {
  @ApiPropertyOptional({ enum: Unidade })
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;
}

export class FindComercialAnaliseDto {
  @ApiPropertyOptional({ enum: COMERCIAL_ANALISE_MODOS, default: 'comparar' })
  @IsOptional()
  @IsIn(COMERCIAL_ANALISE_MODOS)
  modo?: ComercialAnaliseModo = 'comparar';

  @ApiPropertyOptional({
    enum: COMERCIAL_ANALISE_DIMENSOES,
    default: 'vendedor',
    description:
      'vendedor = grade por funcionário; unidade = só TOTAL da loja (não mistura).',
  })
  @IsOptional()
  @IsIn(COMERCIAL_ANALISE_DIMENSOES)
  dimensao?: ComercialAnaliseDimensao = 'vendedor';

  @ApiPropertyOptional({ enum: COMERCIAL_ANALISE_METRICAS, default: 'valor' })
  @IsOptional()
  @IsIn(COMERCIAL_ANALISE_METRICAS)
  metrica?: ComercialAnaliseMetrica = 'valor';

  @ApiPropertyOptional({
    enum: COMERCIAL_ANALISE_BASES,
    default: 'totalVendido',
  })
  @IsOptional()
  @IsIn(COMERCIAL_ANALISE_BASES)
  base?: ComercialAnaliseBase = 'totalVendido';

  @ApiPropertyOptional({
    enum: COMERCIAL_ANALISE_LEITURAS,
    description: 'Só no modo semanas: comparar duas semanas ou a série do mês.',
  })
  @ValidateIf((o: FindComercialAnaliseDto) => o.modo === 'semanas')
  @IsOptional()
  @IsIn(COMERCIAL_ANALISE_LEITURAS)
  leitura?: ComercialAnaliseLeitura;

  @ApiPropertyOptional({ example: '2026-09' })
  @ValidateIf((o: FindComercialAnaliseDto) => (o.modo ?? 'comparar') === 'comparar')
  @IsString()
  @Matches(COMPETENCIA_KEY_REGEX, {
    message: 'c1 deve estar no formato YYYY-MM.',
  })
  c1?: string;

  @ApiPropertyOptional({ example: '2026-10' })
  @ValidateIf((o: FindComercialAnaliseDto) => (o.modo ?? 'comparar') === 'comparar')
  @IsString()
  @Matches(COMPETENCIA_KEY_REGEX, {
    message: 'c2 deve estar no formato YYYY-MM.',
  })
  c2?: string;

  @ApiPropertyOptional({ type: [String] })
  @ValidateIf(
    (o: FindComercialAnaliseDto) =>
      o.modo === 'ranking' || o.modo === 'evolucao',
  )
  @Transform(({ value }) => toCompetencias(value))
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos uma competência.' })
  @IsString({ each: true })
  @Matches(COMPETENCIA_KEY_REGEX, {
    each: true,
    message: 'Cada competência deve estar no formato YYYY-MM.',
  })
  competencias?: string[];

  @ApiPropertyOptional({
    description: 'Semana 1 (modo semanas + comparar). Chave inicio_fim.',
  })
  @ValidateIf(
    (o: FindComercialAnaliseDto) =>
      o.modo === 'semanas' && (o.leitura ?? 'comparar') === 'comparar',
  )
  @IsOptional()
  @IsString()
  @Matches(SEMANA_KEY_REGEX, {
    message: 's1 deve ser a chave da semana (YYYY-MM-DD_YYYY-MM-DD).',
  })
  s1?: string;

  @ApiPropertyOptional({ description: 'Semana 2 (modo semanas + comparar).' })
  @ValidateIf(
    (o: FindComercialAnaliseDto) =>
      o.modo === 'semanas' && (o.leitura ?? 'comparar') === 'comparar',
  )
  @IsOptional()
  @IsString()
  @Matches(SEMANA_KEY_REGEX, {
    message: 's2 deve ser a chave da semana (YYYY-MM-DD_YYYY-MM-DD).',
  })
  s2?: string;

  @ApiPropertyOptional({
    enum: Unidade,
    description: 'Unidade única (obrigatória em dimensao=vendedor).',
  })
  @ValidateIf(
    (o: FindComercialAnaliseDto) => (o.dimensao ?? 'vendedor') === 'vendedor',
  )
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;

  @ApiPropertyOptional({
    enum: Unidade,
    isArray: true,
    description:
      'Só dimensao=unidade. Marcadas no filtro. Vazio = nenhuma. Omitido = todas do escopo.',
  })
  @ValidateIf(
    (o: FindComercialAnaliseDto) => (o.dimensao ?? 'vendedor') === 'unidade',
  )
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const raw = Array.isArray(value) ? value : String(value).split(',');
    const valores = new Set(Object.values(Unidade));
    return [
      ...new Set(
        raw
          .map((item) => String(item ?? '').trim())
          .filter((item): item is Unidade =>
            valores.has(item as Unidade),
          ),
      ),
    ];
  })
  @IsArray()
  @IsEnum(Unidade, { each: true })
  unidades?: Unidade[];

  @ApiPropertyOptional({
    type: [String],
    description:
      'Só em dimensao=vendedor. Vazio = nenhum. Omitido = todos.',
  })
  @ValidateIf(
    (o: FindComercialAnaliseDto) => (o.dimensao ?? 'vendedor') === 'vendedor',
  )
  @IsOptional()
  @Transform(({ value }) => {
    // Query `funcionarioIds=` (vazio) = nenhum marcado; omitido = todos.
    if (value === undefined || value === null) return undefined;
    const raw = Array.isArray(value) ? value : String(value).split(',');
    return [
      ...new Set(
        raw
          .map((item) => String(item ?? '').trim())
          .filter((item) => item.length > 0),
      ),
    ];
  })
  @IsArray()
  @IsUUID(undefined, { each: true })
  funcionarioIds?: string[];
}
