/** Normaliza nome para comparação (trim, espaços, maiúsculas pt-BR). */
export function normalizarNomeComparacao(nome: string | null | undefined): string {
  const base = (nome ?? '').trim().replace(/\s+/g, ' ');
  if (!base) return '';
  try {
    return base.toLocaleUpperCase('pt-BR');
  } catch {
    return base.toUpperCase();
  }
}
