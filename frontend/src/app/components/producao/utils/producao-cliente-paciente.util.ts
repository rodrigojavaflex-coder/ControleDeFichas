function normalizarComparacao(nome: string): string {
  const t = nome.trim();
  try {
    return t.toLocaleUpperCase('pt-BR');
  } catch {
    return t.toUpperCase();
  }
}

/** Exibe cliente e paciente; se diferentes, `cliente / paciente`. */
export function rotuloClientePaciente(
  cliente: string | null | undefined,
  paciente: string | null | undefined,
): string | null {
  const c = (cliente ?? '').trim();
  const p = (paciente ?? '').trim();
  if (!c && !p) {
    return null;
  }
  if (!c) {
    return p;
  }
  if (!p) {
    return c;
  }
  if (normalizarComparacao(c) === normalizarComparacao(p)) {
    return c;
  }
  return `${c} / ${p}`;
}
