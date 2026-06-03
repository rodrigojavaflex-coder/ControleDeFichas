/**
 * Exibição de telefone BR — ex.: (62) 9 8586-1455 (celular 11 dígitos com DDD).
 */
export function formatarTelefoneBrExibicao(raw?: string | null): string {
  const t = raw?.trim();
  if (!t) return '—';

  const digits = t.replace(/\D/g, '');
  if (!digits) return '—';

  let d = digits;
  if (d.startsWith('55') && d.length >= 12) {
    d = d.slice(2);
  }

  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }

  return t;
}
