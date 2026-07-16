const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Normaliza valores de data (string, Date ou ISO datetime) para YYYY-MM-DD. */
export function normalizarDataIso(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    if (ISO_DATE_REGEX.test(value)) {
      return value;
    }
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match?.[1] ?? null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return value.toISOString().slice(0, 10);
  }

  return null;
}

export function compararDataIso(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export function proximoDiaIso(data: string): string | null {
  if (!ISO_DATE_REGEX.test(data)) {
    return null;
  }
  const [year, month, day] = data.split('-').map(Number);
  const proximo = new Date(Date.UTC(year, month - 1, day + 1));
  return proximo.toISOString().slice(0, 10);
}

/** Divide um intervalo YYYY-MM-DD em segmentos mensais (fechamento no último dia de cada mês). */
export function dividirPeriodoEmSegmentosMensais(
  inicio: string,
  fim: string,
): Array<{ inicio: string; fim: string }> {
  if (!ISO_DATE_REGEX.test(inicio) || !ISO_DATE_REGEX.test(fim) || inicio > fim) {
    return [];
  }

  const segmentos: Array<{ inicio: string; fim: string }> = [];
  let cursor = inicio;

  while (cursor <= fim) {
    const [year, month] = cursor.split('-').map(Number);
    const ultimoDiaMes = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const fimMes = `${year}-${String(month).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;
    const fimSegmento = fimMes < fim ? fimMes : fim;
    segmentos.push({ inicio: cursor, fim: fimSegmento });

    if (fimSegmento >= fim) {
      break;
    }

    const proximo = proximoDiaIso(fimSegmento);
    if (!proximo) {
      break;
    }
    cursor = proximo;
  }

  return segmentos;
}
