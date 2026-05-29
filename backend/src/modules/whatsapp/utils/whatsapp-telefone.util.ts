/** Extrai só dígitos; null se vazio. */
export function somenteDigitos(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits || null;
}

/** Normaliza telefone BR para dígitos E.164 (55 + DDD + número), sem canonicalizar o 9º dígito. */
export function normalizarTelefoneE164BR(
  raw: string | null | undefined,
): string | null {
  const digits = somenteDigitos(raw);
  if (!digits) return null;
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return null;
}

/**
 * Formato canônico para WhatsApp BR: E.164 com 13 dígitos (55 + DDD + 9 + 8 dígitos)
 * quando for celular. Meta frequentemente envia `from` sem o 9 — unificamos aqui.
 */
export function canonizarTelefoneWhatsappBR(
  raw: string | null | undefined,
): string | null {
  const digits = somenteDigitos(raw);
  if (!digits) return null;

  let e164 = normalizarTelefoneE164BR(digits);
  if (!e164) {
    if (digits.startsWith('55')) {
      e164 = digits;
    } else {
      return null;
    }
  }

  if (!e164.startsWith('55')) {
    return e164;
  }

  // 55 + DDD(2) + 9 dígitos (celular com 9)
  if (e164.length === 13) {
    return e164;
  }

  // 55 + DDD(2) + 8 dígitos — celular antigo / Meta sem o 9
  if (e164.length === 12) {
    const local = e164.slice(4);
    const primeiroLocal = local.charAt(0);
    // Celular: local começa com 6–9; fixo 2–5 não recebe 9
    if (local.length === 8 && primeiroLocal >= '6' && primeiroLocal <= '9') {
      return `${e164.slice(0, 4)}9${local}`;
    }
    return e164;
  }

  return e164;
}

/** Variantes E.164 (com/sem 9) para busca de conversa existente. */
export function variantesTelefoneConversa(canon: string): string[] {
  const set = new Set<string>([canon]);
  if (canon.startsWith('55') && canon.length === 13 && canon.charAt(4) === '9') {
    set.add(canon.slice(0, 4) + canon.slice(5));
  }
  if (canon.startsWith('55') && canon.length === 12) {
    const local = canon.slice(4);
    if (local.length === 8 && local.charAt(0) >= '6' && local.charAt(0) <= '9') {
      set.add(`${canon.slice(0, 4)}9${local}`);
    }
  }
  return [...set];
}

export function mascararTelefone(telefone: string | null | undefined): string {
  if (!telefone) return '***';
  const digits = telefone.replace(/\D/g, '');
  if (digits.length <= 6) return '***';
  return `${digits.slice(0, 4)}****${digits.slice(-4)}`;
}

/** Formato legível para operadores (E.164 BR → +55 (DDD) 99999-9999). */
export function formatarTelefoneExibicaoBR(
  telefone: string | null | undefined,
): string {
  const canon = canonizarTelefoneWhatsappBR(telefone) ?? somenteDigitos(telefone);
  if (!canon) return telefone?.trim() || '—';

  if (canon.startsWith('55') && (canon.length === 12 || canon.length === 13)) {
    const ddd = canon.slice(2, 4);
    const local = canon.slice(4);
    if (local.length === 9) {
      return `+55 (${ddd}) ${local.slice(0, 5)}-${local.slice(5)}`;
    }
    if (local.length === 8) {
      return `+55 (${ddd}) ${local.slice(0, 4)}-${local.slice(4)}`;
    }
  }

  return canon.startsWith('+') ? canon : `+${canon}`;
}

/** Compara telefones (formatação, 9º dígito BR, DDD+número). */
export function telefonesEquivalentes(a: string, b: string): boolean {
  const ca = canonizarTelefoneWhatsappBR(a);
  const cb = canonizarTelefoneWhatsappBR(b);
  if (ca && cb) {
    return ca === cb;
  }
  const da = somenteDigitos(a);
  const db = somenteDigitos(b);
  if (!da || !db) return false;
  return da === db;
}
