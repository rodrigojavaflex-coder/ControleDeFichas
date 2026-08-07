import {
  ProducaoPainelAlertaCor,
  ProducaoPainelAlertaRetirada,
  ProducaoPainelAlertaTipo,
} from '../entities/producao-painel-alerta-retirada.entity';
import { normalizarCorPainelRetirada } from './producao-painel-cor.util';
import {
  horaCurtaFromDateSp,
  minutosProducaoEntre,
  type ProducaoCalendarioUnidade,
  unidadeUsaHorarioProducaoUtil,
  ymdFromDateSp,
} from './producao-calendario.util';

const OFFSET_SP = '-03:00';

function normalizarHoraRetirada(hora: string | null | undefined): string {
  const h = (hora ?? '').trim();
  if (!h) {
    return '23:59';
  }
  if (/^\d{2}:\d{2}$/.test(h)) {
    return h;
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(h)) {
    return h.slice(0, 5);
  }
  if (/^\d{6}$/.test(h)) {
    return `${h.slice(0, 2)}:${h.slice(2, 4)}`;
  }
  return '23:59';
}

export function instanteRetirada(
  dataRetirada: string | null | undefined,
  horaRetirada: string | null | undefined,
): Date | null {
  if (!dataRetirada?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dataRetirada.trim())) {
    return null;
  }
  const hora = normalizarHoraRetirada(horaRetirada);
  const d = new Date(`${dataRetirada.trim()}T${hora}:00${OFFSET_SP}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Positivo = falta tempo; negativo = atrasado (corrido). */
export function minutosParaRetiradaCorrido(
  dataRetirada: string | null | undefined,
  horaRetirada: string | null | undefined,
  agora: Date,
): number | null {
  const alvo = instanteRetirada(dataRetirada, horaRetirada);
  if (!alvo) {
    return null;
  }
  return Math.round((alvo.getTime() - agora.getTime()) / 60_000);
}

/**
 * Minutos até a retirada (positivo = falta; negativo = atrasado).
 * Corrido por padrão; tempo útil quando a unidade tem jornada com faixas ativas.
 */
export function minutosParaRetirada(
  dataRetirada: string | null | undefined,
  horaRetirada: string | null | undefined,
  agora: Date,
  calendario: ProducaoCalendarioUnidade | null | undefined,
): number | null {
  const alvo = instanteRetirada(dataRetirada, horaRetirada);
  if (!alvo) {
    return null;
  }
  if (calendario && unidadeUsaHorarioProducaoUtil(calendario)) {
    const agoraMs = agora.getTime();
    const alvoMs = alvo.getTime();
    if (agoraMs <= alvoMs) {
      return minutosProducaoEntre(
        ymdFromDateSp(agora),
        horaCurtaFromDateSp(agora),
        alvo,
        calendario,
      );
    }
    const atraso = minutosProducaoEntre(
      dataRetirada!.trim(),
      normalizarHoraRetirada(horaRetirada),
      agora,
      calendario,
    );
    return -Math.max(0, atraso);
  }
  return minutosParaRetiradaCorrido(dataRetirada, horaRetirada, agora);
}

export interface AlertaRetiradaRegra {
  tipo: ProducaoPainelAlertaTipo;
  minutosAntes: number | null;
  cor: string;
  rotulo: string | null;
}

export function mapAlertasEntidade(
  rows: ProducaoPainelAlertaRetirada[],
): AlertaRetiradaRegra[] {
  return [...rows]
    .sort((a, b) => a.ordem - b.ordem)
    .map((r) => ({
      tipo: r.tipo,
      minutosAntes: r.minutosAntes,
      cor: normalizarCorPainelRetirada(r.cor),
      rotulo: r.rotulo,
    }));
}

export function classificarCorPainelRetirada(
  minutosRestantes: number | null,
  alertas: AlertaRetiradaRegra[],
): string {
  if (minutosRestantes == null) {
    return ProducaoPainelAlertaCor.NEUTRO;
  }
  if (minutosRestantes < 0) {
    const atrasado = alertas.find((a) => a.tipo === ProducaoPainelAlertaTipo.ATRASADO);
    return (
      atrasado?.cor ??
      normalizarCorPainelRetirada(ProducaoPainelAlertaCor.VERMELHO)
    );
  }
  const antes = alertas
    .filter((a) => a.tipo === ProducaoPainelAlertaTipo.ANTES && a.minutosAntes != null)
    .sort((a, b) => (a.minutosAntes ?? 0) - (b.minutosAntes ?? 0));
  for (const faixa of antes) {
    const limite = faixa.minutosAntes ?? 0;
    if (minutosRestantes <= limite) {
      return faixa.cor;
    }
  }
  return ProducaoPainelAlertaCor.NEUTRO;
}

/** RN-PCP-010: concluída = `dataSaida` em pelo menos uma etapa configurada como final. */
export function requisicaoFormulaConcluidaPainel(
  linhas: ReadonlyArray<{ codEtapa: string; dataSaida?: string | null }>,
  etapasFinalizacao: ReadonlySet<string> | readonly string[],
): boolean {
  const finais =
    etapasFinalizacao instanceof Set
      ? etapasFinalizacao
      : new Set(etapasFinalizacao);
  if (finais.size === 0) {
    return false;
  }
  return linhas.some(
    (r) => finais.has(r.codEtapa) && !!(r.dataSaida ?? '').trim(),
  );
}
