/** Converte ano/mês (competência) em inteiro comparable (ordem cronológica). */
export function competenciaParaIndice(ano: number, mes: number): number {
  return ano * 12 + mes;
}

/**
 * Normaliza data vinda do cadastro / TypeORM / PG (`date`, string `YYYY-MM-DD`, ISO com hora, `Date`).
 * Evita falha de elegibilidade quando `Date` em memória vira `toString()` não ISO (ex.: "Wed May 01...").
 */
export function normalizarDataCadastroParaIso(val: unknown): string | null {
  if (val == null) return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  if (!s) return null;
  const head = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (head) return head[1];
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

/** Dados do cadastro mínimos para elegibilidade de nova capa (RN-011 / RN-005). */
export type FolhaCadastroDatasParaElegibilidade = {
  ativo: boolean;
  dataAdmissao?: unknown;
  dataDemissao?: unknown;
};

/**
 * Critérios para **criar/listar capa** na competência (RN-011):
 * - funcionário **ativo**
 * - **admissão** com índice (ano×12+mês) **≤ competência**
 * - se houver **demissão**, índice da competência deve ser **menor** que o índice (mês/ano) da demissão.
 */
export function funcionarioElegivelNovaCapaNaCompetencia(
  f: FolhaCadastroDatasParaElegibilidade,
  ano: number,
  mes: number,
): boolean {
  if (!f.ativo) return false;
  const da = normalizarDataCadastroParaIso(f.dataAdmissao);
  if (!da) return false;
  const alvoIndice = competenciaParaIndice(ano, mes);
  try {
    const ia = periodoApartirDaDataIso(da);
    if (ia > alvoIndice) return false;
    if (!f.dataDemissao) return true;
    const demIso = normalizarDataCadastroParaIso(f.dataDemissao);
    if (!demIso) return false;
    const dem = periodoApartirDaDataIso(demIso);
    return alvoIndice < dem;
  } catch {
    return false;
  }
}

/** Espera string de data ISO YYYY-MM-DD (ou com hora ISO). */
export function periodoApartirDaDataIso(isoDate: string): number {
  const dia = isoDate.includes('T')
    ? isoDate.split('T')[0]
    : isoDate.substring(0, 10);
  const [y, m] = dia.split('-').map((n) => parseInt(n, 10));
  if (!y || !m) {
    throw new Error('Data inválida para período ano/mês');
  }
  return competenciaParaIndice(y, m);
}
