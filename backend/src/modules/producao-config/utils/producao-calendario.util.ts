import { minutosDecorridosDesdeEntrada } from '../../producao-acompanhamento/utils/fila-etapa.util';

export interface ProducaoIntervaloHorario {
  horaInicio: string;
  horaFim: string;
}

export interface ProducaoCalendarioUnidade {
  configurado: boolean;
  /** 0 = domingo … 6 = sábado */
  intervalosPorDia: Map<number, ProducaoIntervaloHorario[]>;
  feriados: Set<string>;
}

const OFFSET_SP = '-03:00';

/** Normaliza HH:MM ou HH:MM:SS para minutos desde meia-noite. */
export function horaParaMinutosDia(hora: string): number {
  const h = hora.trim();
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(h);
  if (!m) {
    return 0;
  }
  return Number(m[1]) * 60 + Number(m[2]);
}

export function normalizarHoraCurta(hora: string): string {
  const min = horaParaMinutosDia(hora);
  const hh = Math.floor(min / 60)
    .toString()
    .padStart(2, '0');
  const mm = (min % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function parseInstante(data: string, hora: string): Date {
  const horaNorm = normalizarHoraCurta(hora);
  return new Date(`${data.trim()}T${horaNorm}:00${OFFSET_SP}`);
}

/** Meio-dia SP: weekday estável sem Intl. */
function dowFromYmdSp(ymd: string): number {
  return new Date(`${ymd}T12:00:00${OFFSET_SP}`).getUTCDay();
}

export function ymdFromDateSp(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const mo = parts.find((p) => p.type === 'month')?.value ?? '01';
  const da = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${mo}-${da}`;
}

/** HH:MM em America/Sao_Paulo. */
export function horaCurtaFromDateSp(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hh}:${mm}`;
}

function addDiasYmd(ymd: string, dias: number): string {
  const base = new Date(`${ymd}T12:00:00${OFFSET_SP}`);
  base.setUTCDate(base.getUTCDate() + dias);
  const y = base.getUTCFullYear();
  const mo = String(base.getUTCMonth() + 1).padStart(2, '0');
  const da = String(base.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

export interface CalendarioProducaoComputado {
  minPorDow: readonly number[];
  minutosSemana: number;
  faixasMinutosPorDow: ReadonlyArray<
    ReadonlyArray<{ abreMin: number; fechaMin: number }>
  >;
  feriados: Set<string>;
  temFaixas: boolean;
  configurado: boolean;
}

const calendarioComputadoCache = new WeakMap<
  ProducaoCalendarioUnidade,
  CalendarioProducaoComputado
>();

export function prepararCalendarioProducao(
  calendario: ProducaoCalendarioUnidade,
): CalendarioProducaoComputado {
  const cached = calendarioComputadoCache.get(calendario);
  if (cached) {
    return cached;
  }
  const minPorDow: number[] = [];
  const faixasMinutosPorDow: Array<Array<{ abreMin: number; fechaMin: number }>> =
    [];
  let minutosSemana = 0;
  for (let dow = 0; dow <= 6; dow += 1) {
    const faixas = calendario.intervalosPorDia.get(dow) ?? [];
    const normalizadas: Array<{ abreMin: number; fechaMin: number }> = [];
    let minDia = 0;
    for (const faixa of faixas) {
      const abreMin = horaParaMinutosDia(faixa.horaInicio);
      const fechaMin = horaParaMinutosDia(faixa.horaFim);
      if (fechaMin > abreMin) {
        normalizadas.push({ abreMin, fechaMin });
        minDia += fechaMin - abreMin;
      }
    }
    faixasMinutosPorDow[dow] = normalizadas;
    minPorDow[dow] = minDia;
    minutosSemana += minDia;
  }
  const temFaixas = minutosSemana > 0;
  const prep: CalendarioProducaoComputado = {
    minPorDow,
    minutosSemana,
    faixasMinutosPorDow,
    feriados: calendario.feriados,
    temFaixas,
    configurado: calendario.configurado,
  };
  calendarioComputadoCache.set(calendario, prep);
  return prep;
}

function calendarioTemFaixasProducao(
  calendario: ProducaoCalendarioUnidade,
): boolean {
  return prepararCalendarioProducao(calendario).temFaixas;
}

export function formatDataYmdSp(d: Date): string {
  return ymdFromDateSp(d);
}

function instanteNoDia(dataYmd: string, minutosDesdeMeiaNoite: number): Date {
  const hh = Math.floor(minutosDesdeMeiaNoite / 60)
    .toString()
    .padStart(2, '0');
  const mm = (minutosDesdeMeiaNoite % 60).toString().padStart(2, '0');
  return new Date(`${dataYmd}T${hh}:${mm}:00${OFFSET_SP}`);
}

function minutosProducaoNoDiaPreparado(
  dataYmd: string,
  dow: number,
  inicioMs: number,
  fimMs: number,
  prep: CalendarioProducaoComputado,
): number {
  if (prep.feriados.has(dataYmd)) {
    return 0;
  }
  const faixas = prep.faixasMinutosPorDow[dow] ?? [];
  let totalMin = 0;
  for (const faixa of faixas) {
    const slotInicio = instanteNoDia(dataYmd, faixa.abreMin).getTime();
    const slotFim = instanteNoDia(dataYmd, faixa.fechaMin).getTime();
    const segInicio = Math.max(inicioMs, slotInicio);
    const segFim = Math.min(fimMs, slotFim);
    if (segFim > segInicio) {
      totalMin += Math.round((segFim - segInicio) / 60_000);
    }
  }
  return totalMin;
}

function diaInteiroDentroIntervaloMs(
  dataYmd: string,
  inicioMs: number,
  fimMs: number,
): boolean {
  const dayStart = parseInstante(dataYmd, '00:00').getTime();
  const dayEnd = parseInstante(dataYmd, '23:59').getTime();
  return inicioMs <= dayStart && fimMs >= dayEnd;
}

/** Unidade com jornada salva e ao menos um dia com faixas ativas (horário útil). */
export function unidadeUsaHorarioProducaoUtil(
  calendario: ProducaoCalendarioUnidade | null | undefined,
): boolean {
  return !!(
    calendario?.configurado && calendarioTemFaixasProducao(calendario)
  );
}

/**
 * Minutos entre início (data+hora do registro) e `fim`.
 * Tempo corrido se calendário ausente, não configurado ou **todos os dias sem produção** (sem faixas ativas).
 * Caso contrário, somente minutos dentro das faixas (exc. feriados).
 */
export function minutosProducaoEntre(
  dataInicio: string | null | undefined,
  horaInicio: string | null | undefined,
  fim: Date,
  calendario: ProducaoCalendarioUnidade | null | undefined,
): number {
  if (!dataInicio?.trim() || !calendario) {
    return 0;
  }
  const prep = prepararCalendarioProducao(calendario);
  if (!prep.configurado || !prep.temFaixas) {
    return minutosDecorridosDesdeEntrada(dataInicio, horaInicio, fim);
  }

  const inicio = parseInstante(
    dataInicio,
    horaInicio?.trim() ? horaInicio : '00:00',
  );
  const inicioMs = inicio.getTime();
  const fimMs = fim.getTime();
  if (Number.isNaN(inicioMs) || fimMs <= inicioMs) {
    return 0;
  }

  const minPorDow = prep.minPorDow;
  let totalMin = 0;
  let dataCursor = dataInicio.trim();
  const dataFim = ymdFromDateSp(fim);
  let dow = dowFromYmdSp(dataCursor);
  const limiteSeguranca = 366 * 5;
  let guard = 0;
  const podeBlocoSemanal = prep.feriados.size === 0;

  while (dataCursor <= dataFim && guard < limiteSeguranca) {
    guard += 1;

    if (podeBlocoSemanal && diaInteiroDentroIntervaloMs(dataCursor, inicioMs, fimMs)) {
      let semanaCompleta = true;
      for (let i = 0; i < 7; i += 1) {
        const d = addDiasYmd(dataCursor, i);
        if (d > dataFim || !diaInteiroDentroIntervaloMs(d, inicioMs, fimMs)) {
          semanaCompleta = false;
          break;
        }
      }
      if (semanaCompleta) {
        totalMin += prep.minutosSemana;
        dataCursor = addDiasYmd(dataCursor, 7);
        dow = (dow + 7) % 7;
        continue;
      }
    }

    totalMin += minutosProducaoNoDiaPreparado(
      dataCursor,
      dow,
      inicioMs,
      fimMs,
      prep,
    );

    if (dataCursor === dataFim) {
      break;
    }
    dataCursor = addDiasYmd(dataCursor, 1);
    dow = (dow + 1) % 7;
  }

  return Math.max(0, totalMin);
}

/**
 * Minutos desde entrada na fila/etapa até `agora`.
 * Tempo corrido se calendário ausente ou jornada sem faixas; caso contrário, tempo útil (RN jornada/feriados).
 */
export function minutosDecorridosProducaoDesdeEntrada(
  dataEntrada: string | null | undefined,
  horaEntrada: string | null | undefined,
  agora: Date,
  calendario: ProducaoCalendarioUnidade | null | undefined,
): number {
  if (!dataEntrada?.trim()) {
    return 0;
  }
  if (!calendario) {
    return minutosDecorridosDesdeEntrada(dataEntrada, horaEntrada, agora);
  }
  return minutosProducaoEntre(dataEntrada, horaEntrada, agora, calendario);
}

export function validarFaixasDia(
  faixas: ProducaoIntervaloHorario[],
): string | null {
  const normalizadas = faixas.map((f) => ({
    abre: horaParaMinutosDia(f.horaInicio),
    fecha: horaParaMinutosDia(f.horaFim),
  }));
  for (const f of normalizadas) {
    if (f.fecha <= f.abre) {
      return 'Horário de fechamento deve ser posterior ao de abertura.';
    }
  }
  const sorted = [...normalizadas].sort((a, b) => a.abre - b.abre);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].abre < sorted[i - 1].fecha) {
      return 'Faixas de horário do mesmo dia não podem se sobrepor.';
    }
  }
  return null;
}
