/** Filtro por requisição; `formula` null = todas as fórmulas da requisição. */
export interface FiltroReqFormula {
  requisicao: number;
  formula: string | null;
  filial?: number;
}

export function normalizarFormulaProducao(formula: string): string {
  const t = String(formula ?? '').trim();
  if (!t) {
    return '';
  }
  if (/^\d+$/.test(t)) {
    return String(Number(t));
  }
  return t;
}

export function parseFiltroReqFormula(raw: string): FiltroReqFormula | null {
  const text = raw.trim();
  if (!text) {
    return null;
  }

  const erp = /^(\d+)\s*-\s*(\d+)\s*-\s*(.+)\s*$/.exec(text);
  if (erp) {
    return {
      filial: Number(erp[1]),
      requisicao: Number(erp[2]),
      formula: normalizarFormulaProducao(erp[3]),
    };
  }

  const reqFormula =
    /^(\d+)\s*-\s*(.+?)\s*(?:\(\s*filial\s*(\d+)\s*\))?\s*$/i.exec(text);
  if (reqFormula) {
    const requisicao = Number(reqFormula[1]);
    const formula = normalizarFormulaProducao(reqFormula[2]);
    const filial = reqFormula[3] ? Number(reqFormula[3]) : undefined;
    return { requisicao, formula, filial };
  }

  if (/^\d+$/.test(text)) {
    return { requisicao: Number(text), formula: null };
  }

  return null;
}

export function linhaAtendeFiltroReqFormula(
  lin: { requisicao: number; formula: string; filial: number },
  filtro: FiltroReqFormula,
): boolean {
  if (lin.requisicao !== filtro.requisicao) {
    return false;
  }
  if (filtro.filial != null && lin.filial !== filtro.filial) {
    return false;
  }
  if (filtro.formula == null) {
    return true;
  }
  return (
    normalizarFormulaProducao(lin.formula) ===
    normalizarFormulaProducao(filtro.formula)
  );
}

export function rotuloFiltroReqFormula(filtro: FiltroReqFormula): string {
  if (filtro.formula == null) {
    return `${filtro.requisicao} (todas as fórmulas)`;
  }
  return `${filtro.requisicao}-${filtro.formula}`;
}

export const MENSAGEM_FORMATO_FILTRO_REQ_FORMULA =
  'Informe a requisição (ex.: 155) ou req-fórmula (ex.: 155-0, 155-D ou 2-155-0 para filial).';
