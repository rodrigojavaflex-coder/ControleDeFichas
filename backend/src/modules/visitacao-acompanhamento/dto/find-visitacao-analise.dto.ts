import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';
import { NA_CARTEIRA_FILTRO } from './find-visitacao-acompanhamento.dto';

export const VISITACAO_ANALISE_MODOS = [
  'comparar',
  'ranking',
  'evolucao',
] as const;
export type VisitacaoAnaliseModo = (typeof VISITACAO_ANALISE_MODOS)[number];

/** Chave de competência YYYY-MM (ex.: 2025-12). */
export const COMPETENCIA_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export type VisitacaoAnaliseCompetenciaRef = {
  key: string;
  ano: number;
  mes: number;
};

export function parseCompetenciaKey(
  value: unknown,
): VisitacaoAnaliseCompetenciaRef | null {
  if (value == null || value === '') {
    return null;
  }
  const key = String(value).trim();
  if (!COMPETENCIA_KEY_REGEX.test(key)) {
    return null;
  }
  const [anoStr, mesStr] = key.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  if (!Number.isInteger(ano) || !Number.isInteger(mes)) {
    return null;
  }
  return { key, ano, mes };
}

function toCompetenciasArray(
  value: unknown,
): VisitacaoAnaliseCompetenciaRef[] | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const map = new Map<string, VisitacaoAnaliseCompetenciaRef>();
  for (const item of raw) {
    const parsed = parseCompetenciaKey(item);
    if (parsed) {
      map.set(parsed.key, parsed);
    }
  }
  const list = [...map.values()].sort((a, b) =>
    a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes,
  );
  return list;
}

export class FindVisitacaoAnaliseOpcoesDto {
  @ApiPropertyOptional({
    enum: Unidade,
    description: 'Unidade (obrigatória se o usuário não tiver unidade fixa).',
  })
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;

  @ApiPropertyOptional({
    description:
      'Se true, já retorna a análise dos dois últimos meses fechados (bootstrap, modo comparar).',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  comAnalise?: boolean = false;
}

export class FindVisitacaoAnaliseDto {
  @ApiPropertyOptional({
    enum: VISITACAO_ANALISE_MODOS,
    default: 'comparar',
    description:
      'comparar = Δ entre duas competências; ranking = total/média; evolucao = série por competência (mín. 2).',
  })
  @IsOptional()
  @IsIn(VISITACAO_ANALISE_MODOS)
  modo?: VisitacaoAnaliseModo = 'comparar';

  @ApiPropertyOptional({
    example: '2025-12',
    description:
      'Competência base (YYYY-MM). Obrigatório no modo comparar.',
  })
  @ValidateIf(
    (o: FindVisitacaoAnaliseDto) => (o.modo ?? 'comparar') === 'comparar',
  )
  @IsString()
  @Matches(COMPETENCIA_KEY_REGEX, {
    message: 'c1 deve estar no formato YYYY-MM (ex.: 2025-12).',
  })
  c1?: string;

  @ApiPropertyOptional({
    example: '2026-01',
    description:
      'Competência referência (YYYY-MM). Obrigatório no modo comparar; ≠ c1.',
  })
  @ValidateIf(
    (o: FindVisitacaoAnaliseDto) => (o.modo ?? 'comparar') === 'comparar',
  )
  @IsString()
  @Matches(COMPETENCIA_KEY_REGEX, {
    message: 'c2 deve estar no formato YYYY-MM (ex.: 2026-01).',
  })
  c2?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['2025-11', '2025-12', '2026-01'],
    description:
      'Competências (YYYY-MM). Ranking: ≥1; Evolução: ≥2. Aceita lista ou `a,b,c`.',
  })
  @ValidateIf(
    (o: FindVisitacaoAnaliseDto) =>
      o.modo === 'ranking' || o.modo === 'evolucao',
  )
  @Transform(({ value }) => {
    const list = toCompetenciasArray(value);
    return list?.map((c) => c.key);
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'Informe ao menos uma competência fechada.',
  })
  @IsString({ each: true })
  @Matches(COMPETENCIA_KEY_REGEX, {
    each: true,
    message: 'Cada competência deve estar no formato YYYY-MM.',
  })
  competencias?: string[];

  @ApiPropertyOptional({
    enum: Unidade,
    description: 'Unidade (obrigatória se o usuário não tiver unidade fixa).',
  })
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;

  @ApiPropertyOptional({
    description: 'Filtra pela carteira do funcionário vinculado ao painel',
  })
  @IsOptional()
  @IsUUID()
  funcionarioId?: string;

  @ApiPropertyOptional({ description: 'Nome do médico (parcial)' })
  @IsOptional()
  @IsString()
  nomeMedico?: string;

  @ApiPropertyOptional({
    enum: NA_CARTEIRA_FILTRO,
    description: 'Filtro de presença no painel (No Painel)',
    default: 'todos',
  })
  @IsOptional()
  @IsIn(NA_CARTEIRA_FILTRO)
  naCarteira?: (typeof NA_CARTEIRA_FILTRO)[number] = 'todos';

  @ApiPropertyOptional({
    description:
      'Limite opcional por grade. Omitido = todos os médicos com variação/movimento.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  top?: number;
}
