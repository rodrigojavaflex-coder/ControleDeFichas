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
