import { proximoDiaIso } from '../../common/utils/data-date.util';
import {
  dowFromYmdSp,
  periodoCompetencia,
} from '../visitacao-acompanhamento/utils/visitacao-dias-uteis.util';

/** Mesmo piso de competência do acompanhamento comercial. */
export const COMERCIAL_ANALISE_ANO_MIN = 2026;

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

const MESES_CURTO = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

export type PeriodoAnalise = {
  key: string;
  ano: number;
  mes: number;
  label: string;
  labelCurto: string;
  previa: boolean;
  inicio: string;
  fim: string;
};

export type SemanaAnalise = {
  /** `inicio_fim` do intervalo de venda (até hoje na semana prévia). */
  key: string;
  inicio: string;
  /** Fim da venda e do rótulo. Na semana de hoje, é o próprio hoje. */
  fim: string;
  /**
   * Fim dos rejeitados. Semanas encerradas = fim.
   * Semana prévia = fim do mês, para a soma fechar com o card
   * (o acompanhamento não corta rejeitados em hoje).
   */
  fimRejeitado: string;
  label: string;
  labelCurto: string;
  previa: boolean;
};

export function chaveCompetencia(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

export function parseCompetenciaKey(
  value: unknown,
): { key: string; ano: number; mes: number } | null {
  if (value == null || value === '') return null;
  const key = String(value).trim();
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(key);
  if (!match) return null;
  return { key, ano: Number(match[1]), mes: Number(match[2]) };
}

/** Competências de ANO_MIN até o mês corrente (America/Sao_Paulo). Futuras ficam de fora. */
export function listarCompetenciasAnalise(hoje: string): PeriodoAnalise[] {
  const anoHoje = Number(hoje.slice(0, 4));
  const mesHoje = Number(hoje.slice(5, 7));
  if (!Number.isInteger(anoHoje) || !Number.isInteger(mesHoje)) {
    return [];
  }
  const lista: PeriodoAnalise[] = [];
  const anoFim = Math.max(anoHoje, COMERCIAL_ANALISE_ANO_MIN);
  for (let ano = COMERCIAL_ANALISE_ANO_MIN; ano <= anoFim; ano += 1) {
    if (ano > anoHoje) break;
    const mesMax = ano === anoHoje ? mesHoje : 12;
    for (let mes = 1; mes <= mesMax; mes += 1) {
      const periodo = periodoCompetencia(ano, mes);
      const previa = ano === anoHoje && mes === mesHoje;
      const nome = MESES[mes - 1] ?? String(mes);
      const curto = MESES_CURTO[mes - 1] ?? String(mes);
      lista.push({
        key: periodo.anoMes,
        ano,
        mes,
        label: previa ? `${nome}/${ano} (prévia)` : `${nome}/${ano}`,
        labelCurto: previa ? `${curto}/${ano} (prévia)` : `${curto}/${ano}`,
        previa,
        inicio: periodo.dataInicial,
        fim: periodo.dataFinal,
      });
    }
  }
  return lista;
}

function adicionarDias(inicio: string, dias: number): string {
  let cursor = inicio;
  for (let i = 0; i < dias; i += 1) {
    const next = proximoDiaIso(cursor);
    if (!next) return cursor;
    cursor = next;
  }
  return cursor;
}

/** Ex.: 19 a 25 de Out (dias sem zero à esquerda; mês abreviado). */
export function rotuloIntervalo(inicio: string, fim: string): string {
  const diaIni = Number(inicio.slice(8, 10));
  const diaFim = Number(fim.slice(8, 10));
  const mes = Number(fim.slice(5, 7));
  const mesCurto = MESES_CURTO[mes - 1] ?? String(mes);
  return `${diaIni} a ${diaFim} de ${mesCurto}`;
}

/**
 * Semanas segunda–domingo do mês de `hoje`, cortadas no mês.
 * A semana que contém hoje termina hoje (prévia). Semanas seguintes não entram.
 * Rejeitados da semana prévia seguem até o fim do mês.
 */
export function semanasMesCorrente(hoje: string): SemanaAnalise[] {
  const ano = Number(hoje.slice(0, 4));
  const mes = Number(hoje.slice(5, 7));
  if (!Number.isInteger(ano) || mes < 1 || mes > 12) {
    return [];
  }
  const periodo = periodoCompetencia(ano, mes);
  if (hoje < periodo.dataInicial || hoje > periodo.dataFinal) {
    return [];
  }
  const semanas: SemanaAnalise[] = [];
  let cursor = periodo.dataInicial;
  while (cursor <= periodo.dataFinal && cursor <= hoje) {
    const dow = dowFromYmdSp(cursor);
    const diasAteDomingo = dow === 0 ? 0 : 7 - dow;
    let fimCalendario = adicionarDias(cursor, diasAteDomingo);
    if (fimCalendario > periodo.dataFinal) {
      fimCalendario = periodo.dataFinal;
    }
    const previa = hoje >= cursor && hoje <= fimCalendario;
    const fim = previa ? hoje : fimCalendario;
    const fimRejeitado = previa ? periodo.dataFinal : fimCalendario;
    const rotulo = rotuloIntervalo(cursor, fim);
    semanas.push({
      key: `${cursor}_${fim}`,
      inicio: cursor,
      fim,
      fimRejeitado,
      label: previa ? `${rotulo} (prévia)` : rotulo,
      labelCurto: previa ? `${rotulo} (prévia)` : rotulo,
      previa,
    });
    if (previa) break;
    const next = proximoDiaIso(fimCalendario);
    if (!next || next <= cursor) break;
    cursor = next;
  }
  return semanas;
}
