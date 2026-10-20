export interface RpsItemExtraido {
  protocolo: string;
  valorTotal: number;
  arquivoOrigem: string;
  itemRaw: string;
}

const ITEM_PROTOCOL_RE =
  /(?:^|\s)\d{3}\s+\d{4}\/(\d+)-\d\s+FORMULA/i;
const VALUE_LINE_RE =
  /^\s*(\d+)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;

function parseBrMoney(value: string): number {
  return Number(value.replace(/\./g, '').replace(',', '.'));
}

/**
 * Extrai pares protocolo + valor total da discriminação de serviços de um RPS (PDF textual).
 * Padrão observado: `001 0035/236022-0 FORMULA C/...` seguido de `1 82,61 82,61`.
 */
export function parseRpsText(
  text: string,
  arquivoOrigem = 'rps.pdf',
): RpsItemExtraido[] {
  const lines = text.split(/\r?\n/);
  const itens: RpsItemExtraido[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim() ?? '';
    const itemMatch = line.match(ITEM_PROTOCOL_RE);
    if (!itemMatch) {
      continue;
    }

    const protocolo = itemMatch[1].trim();
    if (!/^\d+$/.test(protocolo)) {
      continue;
    }

    let valorTotal: number | null = null;
    for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      const candidate = lines[j]?.trim() ?? '';
      const valueMatch = candidate.match(VALUE_LINE_RE);
      if (!valueMatch) {
        // Descrição pode ocupar linhas intermediárias
        if (ITEM_PROTOCOL_RE.test(candidate)) {
          break;
        }
        continue;
      }

      const qtde = Number(valueMatch[1]);
      const total = parseBrMoney(valueMatch[3]);

      // Itens da discriminação usam qtde 1; rodapé (alíquota/ISS/total RPS) fica de fora.
      if (qtde !== 1 || !Number.isFinite(total) || total <= 0) {
        continue;
      }

      valorTotal = Math.round(total * 100) / 100;
      break;
    }

    if (valorTotal == null) {
      continue;
    }

    itens.push({
      protocolo,
      valorTotal,
      arquivoOrigem,
      itemRaw: line,
    });
  }

  return dedupeItensPorProtocolo(itens);
}

function dedupeItensPorProtocolo(
  itens: RpsItemExtraido[],
): RpsItemExtraido[] {
  const map = new Map<string, RpsItemExtraido>();
  for (const item of itens) {
    map.set(item.protocolo, item);
  }
  return Array.from(map.values());
}
