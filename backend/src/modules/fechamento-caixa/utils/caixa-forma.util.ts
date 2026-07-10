/** Forma ERP convênio em dinheiro — compõe o bloco DINHEIRO, não card CONVÊNIO. */
export const FORMA_ERP_CONVENIO_DINHEIRO = 'CONVENIO-DINHEIRO';

/** Formas consolidadas exibidas no fechamento de caixa. */
export const FORMAS_FECHAMENTO_CAIXA = [
  'DINHEIRO',
  'CARTÃO/PIX',
  'DEPOSITO',
] as const;

export type FormaFechamentoCaixa = (typeof FORMAS_FECHAMENTO_CAIXA)[number];

export function ordenarFormasFechamento(formas: string[]): string[] {
  const ordem = new Map(
    FORMAS_FECHAMENTO_CAIXA.map((forma, index) => [forma, index]),
  );

  return [...formas].sort((a, b) => {
    const indiceA =
      ordem.get(a as FormaFechamentoCaixa) ?? Number.MAX_SAFE_INTEGER;
    const indiceB =
      ordem.get(b as FormaFechamentoCaixa) ?? Number.MAX_SAFE_INTEGER;
    if (indiceA !== indiceB) {
      return indiceA - indiceB;
    }
    return a.localeCompare(b, 'pt-BR');
  });
}

/** Bloco/card do fechamento ao qual a forma ERP ou terceiro pertence. */
export function formaBlocoFechamento(forma: string): string {
  if (forma === FORMA_ERP_CONVENIO_DINHEIRO || forma === 'DINHEIRO') {
    return 'DINHEIRO';
  }
  return normalizarFormaErp(forma);
}

export function ordenarLinhasErpNoBloco(a: string, b: string): number {
  const ordem = ['DINHEIRO', FORMA_ERP_CONVENIO_DINHEIRO];
  const indiceA = ordem.indexOf(a);
  const indiceB = ordem.indexOf(b);
  if (indiceA >= 0 && indiceB >= 0) {
    return indiceA - indiceB;
  }
  if (indiceA >= 0) {
    return -1;
  }
  if (indiceB >= 0) {
    return 1;
  }
  return a.localeCompare(b, 'pt-BR');
}

export function normalizarFormaErp(forma: string): string {
  if (forma === FORMA_ERP_CONVENIO_DINHEIRO) {
    return FORMA_ERP_CONVENIO_DINHEIRO;
  }
  if (forma === 'CARTAO PRE') {
    return 'CARTÃO/PIX';
  }
  if (forma === 'DINHEIRO') {
    return 'DINHEIRO';
  }
  if (forma === 'DEPOSITO') {
    return 'DEPOSITO';
  }
  return forma;
}

export function normalizarFormaTerceiro(forma: string): string {
  if (forma === 'CARTÃO/PIX') {
    return 'CARTÃO/PIX';
  }
  if (forma === 'DINHEIRO' || forma === 'DEPOSITO') {
    return forma;
  }
  return forma;
}
