/** Chave única requisição+fórmula no escopo da unidade/filial. */
export function chaveRequisicaoFormula(
  unidade: string,
  filial: number,
  requisicao: number,
  formula: string,
): string {
  return `${unidade}|${filial}|${requisicao}|${formula}`;
}

/** Normaliza hora PCP (HH:MM ou HH:MM:SS) para parsing. */
function normalizarHoraEntrada(horaEntrada: string | null | undefined): string {
  const h = (horaEntrada ?? '').trim();
  if (!h) {
    return '00:00:00';
  }
  if (/^\d{2}:\d{2}$/.test(h)) {
    return `${h}:00`;
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(h)) {
    return h;
  }
  if (/^\d{6}$/.test(h)) {
    return `${h.slice(0, 2)}:${h.slice(2, 4)}:${h.slice(4, 6)}`;
  }
  return '00:00:00';
}

/**
 * Minutos decorridos desde data/hora de entrada até `agora`.
 * Usa offset fixo -03:00 (America/Sao_Paulo sem DST).
 */
export function minutosDecorridosDesdeEntrada(
  dataEntrada: string | null | undefined,
  horaEntrada: string | null | undefined,
  agora: Date = new Date(),
): number {
  if (!dataEntrada?.trim()) {
    return 0;
  }
  const hora = normalizarHoraEntrada(horaEntrada);
  const inicio = new Date(`${dataEntrada.trim()}T${hora}-03:00`);
  if (Number.isNaN(inicio.getTime())) {
    return 0;
  }
  const diffMs = agora.getTime() - inicio.getTime();
  return Math.max(0, Math.round(diffMs / 60_000));
}
