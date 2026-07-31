/** Parse EVENTO FC01M20 — padrão REQUISICAO: {cdfil}-{nrrqu}-{serier} */
const REQUISICAO_TOKEN =
  /REQUISICAO:\s*(\d+)\s*-\s*(\d+)\s*-\s*(\d+)/i;

const MOTIVO_TOKEN = /MOTIVO:\s*(.+?)(?:\s*$|\s*-)/i;

export interface ExclusaoReceitaParseada {
  filial: number;
  requisicao: number;
  formula: string;
  data_exclusao: string;
  hora_exclusao: string | null;
  cdusu: number | null;
  motivo: string | null;
  evento: string;
}

export function parseExclusaoReceitaEvento(
  row: Record<string, unknown>,
): ExclusaoReceitaParseada | null {
  const evento = String(
    row.evento ?? row.EVENTO ?? row.evento_raw ?? '',
  ).trim();
  const match = REQUISICAO_TOKEN.exec(evento);
  if (!match) {
    return null;
  }

  const filial = Number(match[1]);
  const requisicao = Number(match[2]);
  const formula = String(Number(match[3]));

  const dataRaw = row.data ?? row.DATA ?? row.data_exclusao;
  let data_exclusao = '';
  if (dataRaw instanceof Date) {
    data_exclusao = dataRaw.toISOString().slice(0, 10);
  } else {
    const s = String(dataRaw ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      data_exclusao = s.slice(0, 10);
    }
  }
  if (!data_exclusao) {
    return null;
  }

  const horaRaw = row.hora ?? row.HORA;
  const hora_exclusao =
    horaRaw != null && String(horaRaw).trim()
      ? String(horaRaw).trim().slice(0, 8)
      : null;

  const cdusuRaw = row.cdusu ?? row.CDUSU ?? row.usuario;
  let cdusu: number | null = null;
  if (cdusuRaw != null && String(cdusuRaw).trim()) {
    const n = Number(String(cdusuRaw).trim());
    cdusu = Number.isFinite(n) ? n : null;
  }

  const motivoMatch = MOTIVO_TOKEN.exec(evento);
  const motivo = motivoMatch
    ? motivoMatch[1].trim().slice(0, 500)
    : null;

  return {
    filial,
    requisicao,
    formula,
    data_exclusao,
    hora_exclusao,
    cdusu,
    motivo,
    evento,
  };
}

export function deduplicarExclusoesPorFormula(
  itens: ExclusaoReceitaParseada[],
): ExclusaoReceitaParseada[] {
  const map = new Map<string, ExclusaoReceitaParseada>();
  for (const item of itens) {
    const key = `${item.filial}|${item.requisicao}|${item.formula}`;
    const existente = map.get(key);
    if (!existente) {
      map.set(key, item);
      continue;
    }
    const cmp = `${item.data_exclusao} ${item.hora_exclusao ?? ''}`.localeCompare(
      `${existente.data_exclusao} ${existente.hora_exclusao ?? ''}`,
    );
    if (cmp > 0) {
      map.set(key, item);
    }
  }
  return [...map.values()];
}
