/** Quantidade da imagem: inteiro sem casa; fração com uma casa e ponto. */
export function formatarQuantidadeImagem(valor: number): string {
  if (!Number.isFinite(valor)) {
    return '0';
  }
  const arredondado = Math.round(valor * 10) / 10;
  if (Math.abs(arredondado - Math.round(arredondado)) < 0.001) {
    return String(Math.round(arredondado));
  }
  return arredondado.toFixed(1);
}

export function formatarQuantidadeAtivo(valor: number): string {
  if (!Number.isFinite(valor)) {
    return '0.0';
  }
  return valor.toFixed(1);
}

/**
 * Linha de embalagem da imagem.
 * UNICONT de cápsula: doses × cápsulas por dose.
 * UNIVOL CAP sem conteúdo em cápsula: só o volume em caps.
 */
export function textoEmbalagemOrcamento(input: {
  volume: number;
  univol: string;
  qtcont: number;
  unicont: string;
  qtfor: number;
}): string {
  const embalagens =
    Number.isFinite(input.qtfor) && input.qtfor > 0
      ? Math.round(input.qtfor)
      : 1;
  const prefixo = `Embalagem: ${embalagens} - Quant: `;
  const univol = input.univol.trim().toUpperCase();
  const unicont = input.unicont.trim().toUpperCase();

  if (unicont.startsWith('CAP') && input.qtcont > 0) {
    const caps = input.volume * input.qtcont;
    return (
      `${prefixo}${formatarQuantidadeImagem(input.volume)} doses ` +
      `(${formatarQuantidadeImagem(input.qtcont)} cap/dose) = ` +
      `${formatarQuantidadeImagem(caps)} caps`
    );
  }

  if (univol === 'CAP' || univol === 'CPS') {
    return `${prefixo}${formatarQuantidadeImagem(input.volume)} caps`;
  }

  const unidade = univol.trim();
  return `${prefixo}${formatarQuantidadeImagem(input.volume)}${unidade ? ` ${unidade}` : ''}`;
}

export function linhaAtivoOrcamento(
  descricao: string,
  quantidade: number,
  unidade: string,
): string {
  const unida = unidade.trim();
  return `${descricao.trim()} - ${formatarQuantidadeAtivo(quantidade)}${unida ? ` ${unida}` : ''}`;
}

export function compararSerieOrcamento(a: string, b: string): number {
  const na = /^\d+$/.test(a);
  const nb = /^\d+$/.test(b);
  if (na && nb) {
    return Number(a) - Number(b);
  }
  if (na) {
    return -1;
  }
  if (nb) {
    return 1;
  }
  return a.localeCompare(b, 'pt-BR');
}

export function arredondarMoeda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
