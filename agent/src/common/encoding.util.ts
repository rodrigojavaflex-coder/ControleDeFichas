import * as iconv from 'iconv-lite';

const MOJIBAKE_PATTERN = /Ã§|Ã£|Ã¡|Ã©|Ã­|Ã³|Ãº|Ãµ|Ã /;
const SUSPEITO_PATTERN = /[ýÿÝÃ\uFFFD]/;

const SUFIXO_CO_VALIDO = /^(MAR|MA|AL|MON|BRA|FER|CAR)ÇO$/i;

export function precisaCorrecaoEncoding(str: string): boolean {
  if (!str) return false;
  if (MOJIBAKE_PATTERN.test(str)) return true;
  if (SUSPEITO_PATTERN.test(str)) return true;
  if (/\bJÇ[A-ZÀ-Ú]/i.test(str)) return true;

  const matchCo = str.match(/\b(\w+ÇO)\b/i);
  if (matchCo && !SUFIXO_CO_VALIDO.test(matchCo[1])) {
    return true;
  }

  return false;
}

export function converterTextoFirebird(
  str: string | Buffer | null | undefined,
  sourceCharset: string = 'NONE',
): string {
  if (!str) return '';

  const charsetNormalizado = sourceCharset?.trim() || 'NONE';
  const effectiveCharset =
    charsetNormalizado === 'NONE' ? 'WIN1252' : charsetNormalizado;

  if (Buffer.isBuffer(str)) {
    try {
      return fixCorruptedChars(iconv.decode(str, effectiveCharset));
    } catch {
      return fixCorruptedChars(str.toString('utf8'));
    }
  }

  if (typeof str !== 'string') {
    return fixCorruptedChars(String(str));
  }

  try {
    const buffer = Buffer.from(str, 'latin1');

    try {
      const decodedWin1252 = iconv.decode(buffer, effectiveCharset);
      if (!SUSPEITO_PATTERN.test(decodedWin1252) || charsetNormalizado === 'NONE') {
        return fixCorruptedChars(decodedWin1252);
      }
    } catch {
      /* tenta alternativa */
    }

    try {
      const decodedIso = iconv.decode(buffer, 'ISO-8859-1');
      if (!SUSPEITO_PATTERN.test(decodedIso)) {
        return fixCorruptedChars(decodedIso);
      }
    } catch {
      /* tenta fallback */
    }

    return fixCorruptedChars(iconv.decode(buffer, effectiveCharset));
  } catch {
    return fixCorruptedChars(str);
  }
}

export function converterObjetoFirebird<T>(
  obj: unknown,
  sourceCharset: string = 'NONE',
): T {
  if (obj === null || obj === undefined) {
    return obj as T;
  }

  if (obj instanceof Date) {
    return obj as T;
  }

  if (Buffer.isBuffer(obj)) {
    return converterTextoFirebird(obj, sourceCharset) as T;
  }

  if (
    typeof obj === 'number' ||
    typeof obj === 'boolean' ||
    typeof obj === 'bigint'
  ) {
    return obj as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => converterObjetoFirebird(item, sourceCharset)) as T;
  }

  if (typeof obj === 'object') {
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const convertedKey = converterTextoFirebird(key, sourceCharset);
      converted[convertedKey] =
        typeof value === 'string' || Buffer.isBuffer(value)
          ? converterTextoFirebird(value, sourceCharset)
          : converterObjetoFirebird(value, sourceCharset);
    }
    return converted as T;
  }

  if (typeof obj === 'string') {
    return converterTextoFirebird(obj, sourceCharset) as T;
  }

  return obj as T;
}

export function corrigirEncodingLegado(
  str: string | null | undefined,
  sourceCharset: string = 'NONE',
): string {
  if (!str) return '';
  return converterTextoFirebird(str, sourceCharset);
}

function fixCorruptedChars(str: string): string {
  if (!str) return str;

  let fixed = str
    .replace(/Cýpsula/gi, 'Cápsula')
    .replace(/Loýção/gi, 'Loção')
    .replace(/Loýo/gi, 'Loção')
    .replace(/ÇýO/gi, 'ÇÃO')
    .replace(/([A-ZÀ-Ú])ýO/gi, '$1ÃO')
    .replace(/([A-ZÀ-Ú])ý(?=[A-ZÀ-Ú])/g, '$1É')
    .replace(/([GNRL])ý([AO])/gi, '$1Ç$2')
    .replace(/Çý/gi, 'Çã')
    .replace(/ý/g, 'Ç')
    .replace(/Ý/g, 'Ç')
    .replace(/Ã§/g, 'ç')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã£/g, 'ã')
    .replace(/Ãµ/g, 'õ')
    .replace(/Ã /g, 'à')
    .replace(/Ã‡/g, 'Ç')
    .replace(/Ãƒ/g, 'Ã');

  const temPalavraValida =
    /GONÇAL|MARÇAL|LUÇA|FAÇA|COÇA|REÇA|AÇA|GONÇA|MARÇ|LUÇ|FAÇ|COÇ|REÇ|AÇ/i.test(
      fixed,
    );

  if (!temPalavraValida) {
    fixed = fixed
      .replace(/ÇTIMA/g, 'ÁTIMA')
      .replace(/ÇTIMO/g, 'ÁTIMO')
      .replace(/ÇT([A-Z])/g, 'ÁT$1')
      .replace(/([FMNRL])Ç([TMNRP])/g, '$1Á$2');
  } else {
    fixed = fixed.replace(/ÇTIMA/g, 'ÁTIMA').replace(/ÇTIMO/g, 'ÁTIMO');
  }

  fixed = corrigirPadroesGravadosErrados(fixed);

  if (SUSPEITO_PATTERN.test(fixed) || MOJIBAKE_PATTERN.test(fixed)) {
    try {
      const originalBytes = Buffer.from(str, 'latin1');
      for (const charset of ['WIN1252', 'ISO-8859-1'] as const) {
        try {
          const decoded = iconv.decode(originalBytes, charset);
          if (
            !SUSPEITO_PATTERN.test(decoded) &&
            !MOJIBAKE_PATTERN.test(decoded)
          ) {
            return corrigirPadroesGravadosErrados(decoded);
          }
        } catch {
          /* próximo charset */
        }
      }
    } catch {
      /* mantém fixed */
    }
  }

  return fixed;
}

export function corrigirPadroesGravadosErrados(str: string): string {
  return str
    .replace(/\bCÇpsulas?\b/gi, (match) => match.replace(/CÇ/i, 'Cá'))
    .replace(/\b(\w+)ÇÇo\b/gi, (_, prefix: string) => `${prefix}ção`)
    .replace(/\bJÇ([A-ZÀ-Ú])/g, 'JÉ$1')
    .replace(/\b([A-ZÀ-Ú]+)ÇO\b/g, (match, prefix: string) => {
      const palavra = `${prefix}ÇO`;
      if (SUFIXO_CO_VALIDO.test(palavra)) return match;
      return `${prefix}ÃO`;
    });
}

export function corrigirEncodingLegadoNullable(
  str: string | null | undefined,
  sourceCharset: string = 'NONE',
): string | null {
  if (str === null || str === undefined) return null;
  const normalized = converterTextoFirebird(String(str).trim(), sourceCharset);
  return normalized || null;
}
