const OFFSET_SP = '-03:00';

export const VISITACAO_ANO_MIN = 2026;
export const VISITACAO_ANO_MAX = 2033;

export type PeriodoCompetencia = {
  ano: number;
  mes: number;
  anoMes: string;
  dataInicial: string;
  dataFinal: string;
};

/** Competência YYYY-MM → primeiro e último dia (calendário civil). */
export function periodoCompetencia(ano: number, mes: number): PeriodoCompetencia {
  if (mes < 1 || mes > 12) {
    throw new Error('Mês da competência deve estar entre 1 e 12.');
  }
  const mm = String(mes).padStart(2, '0');
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return {
    ano,
    mes,
    anoMes: `${ano}-${mm}`,
    dataInicial: `${ano}-${mm}-01`,
    dataFinal: `${ano}-${mm}-${String(ultimo).padStart(2, '0')}`,
  };
}

export function ymdHojeSp(agora = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(agora);
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const mo = parts.find((p) => p.type === 'month')?.value ?? '01';
  const da = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${mo}-${da}`;
}

/** 0 = domingo … 6 = sábado (meio-dia SP, weekday estável). */
export function dowFromYmdSp(ymd: string): number {
  return new Date(`${ymd}T12:00:00${OFFSET_SP}`).getUTCDay();
}

export function competenciaAberta(
  hojeYmd: string,
  dataInicial: string,
  dataFinal: string,
): boolean {
  return hojeYmd >= dataInicial && hojeYmd <= dataFinal;
}

/**
 * Peso de dia útil da visitação.
 * Seg–sex = 1; sábado = 0,5 se marcado; domingo = 0; feriado = 0.
 */
export function pesoDiaUtilVisitacao(
  ymd: string,
  sabadoMeioDia: boolean,
  feriados: ReadonlySet<string>,
): number {
  if (feriados.has(ymd)) {
    return 0;
  }
  const dow = dowFromYmdSp(ymd);
  if (dow === 0) {
    return 0;
  }
  if (dow === 6) {
    return sabadoMeioDia ? 0.5 : 0;
  }
  return 1;
}

export function somarDiasUteisVisitacao(
  dataInicial: string,
  dataFinal: string,
  sabadoMeioDia: boolean,
  feriados: ReadonlySet<string>,
): number {
  if (dataInicial > dataFinal) {
    return 0;
  }
  let soma = 0;
  let cursor = dataInicial;
  while (cursor <= dataFinal) {
    soma += pesoDiaUtilVisitacao(cursor, sabadoMeioDia, feriados);
    cursor = addDiasYmd(cursor, 1);
  }
  return soma;
}

/** Soma o peso (RN-CAL-001) das datas informadas, sem duplicar o dia. */
export function somarPesoDiasVisitacao(
  datas: readonly string[],
  sabadoMeioDia: boolean,
  feriados: ReadonlySet<string>,
): number {
  const unicas = new Set(datas.filter(Boolean));
  let soma = 0;
  for (const ymd of unicas) {
    soma += pesoDiaUtilVisitacao(ymd, sabadoMeioDia, feriados);
  }
  return soma;
}

/**
 * Dias realizados: úteis da competência até o último caixa CONFIRMADO
 * (Fechado ou Bloqueado na tela). Sem confirmação, 0.
 */
export function somarDiasRealizadosVisitacao(
  dataInicial: string,
  dataFinal: string,
  ultimaConfirmada: string | null,
  sabadoMeioDia: boolean,
  feriados: ReadonlySet<string>,
): number {
  if (!ultimaConfirmada || ultimaConfirmada < dataInicial) {
    return 0;
  }
  const ate = ultimaConfirmada < dataFinal ? ultimaConfirmada : dataFinal;
  return somarDiasUteisVisitacao(dataInicial, ate, sabadoMeioDia, feriados);
}

function addDiasYmd(ymd: string, dias: number): string {
  const base = new Date(`${ymd}T12:00:00${OFFSET_SP}`);
  base.setUTCDate(base.getUTCDate() + dias);
  const y = base.getUTCFullYear();
  const mo = String(base.getUTCMonth() + 1).padStart(2, '0');
  const da = String(base.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}
