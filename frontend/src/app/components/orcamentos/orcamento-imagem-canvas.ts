import { OrcamentoImagem } from '../../models/orcamento-imagem.model';

const LARGURA = 800;
const PADDING = 28;
const ALTURA_MAXIMA = 16000;

interface LinhaDesenho {
  tipo: 'texto' | 'traco';
  texto?: string;
  peso?: '400' | '700';
  tamanho?: number;
  altura: number;
}

export interface TrechoTextoImagem {
  texto: string;
  peso: '400' | '700';
  sublinhado: boolean;
}

export interface LinhaEditadaImagem {
  trechos: TrechoTextoImagem[];
  separador: boolean;
  tamanho: number;
  altura: number;
}

export function htmlTextoOrcamentoImagem(dados: OrcamentoImagem): string {
  return linhasTextoOrcamentoImagem(dados)
    .map((linha) => {
      if (linha.separador) {
        return '<hr>';
      }
      const marca = linha.peso === '700' ? 'strong' : 'span';
      return `<p data-tamanho="${linha.tamanho}" data-altura="${linha.altura}"><${marca}>${escaparHtml(linha.texto)}</${marca}></p>`;
    })
    .join('');
}

export function lerTextoEditado(raiz: HTMLElement): LinhaEditadaImagem[] {
  const linhas: LinhaEditadaImagem[] = [];
  for (const node of Array.from(raiz.childNodes)) {
    if (!(node instanceof HTMLElement)) {
      const solto = (node.textContent ?? '').replace(/\u00a0/g, ' ');
      if (solto.trim()) {
        linhas.push(linhaSimples(solto));
      }
      continue;
    }
    if (node.tagName === 'HR') {
      linhas.push({ trechos: [], separador: true, tamanho: 16, altura: 22 });
      continue;
    }
    linhas.push(...linhasDoBloco(node));
  }
  return linhas.filter((linha) => linha.separador || linha.trechos.some((trecho) => trecho.texto.trim()));
}

export async function desenharOrcamentoImagem(
  dados: OrcamentoImagem,
  topo: HTMLImageElement,
  rodape: HTMLImageElement,
): Promise<Blob> {
  return desenharLinhasOrcamentoImagem(linhasDeDados(dados), topo, rodape);
}

export async function desenharLinhasOrcamentoImagem(
  linhas: LinhaEditadaImagem[],
  topo: HTMLImageElement,
  rodape: HTMLImageElement,
): Promise<Blob> {
  const medida = document.createElement('canvas').getContext('2d');
  if (!medida) {
    throw new Error('Não foi possível montar a imagem.');
  }

  const larguraTexto = LARGURA - PADDING * 2;
  const quebradas: LinhaEditadaImagem[] = [];
  for (const linha of linhas) {
    if (linha.separador) {
      quebradas.push(linha);
      continue;
    }
    quebradas.push(...quebrarLinhaEditada(medida, linha, larguraTexto));
  }

  const alturaTopo = alturaProporcional(topo);
  const alturaRodape = alturaProporcional(rodape);
  const alturaMiolo = quebradas.reduce((soma, linha) => soma + linha.altura, 0) + 36;
  const altura = alturaTopo + alturaMiolo + alturaRodape;
  if (altura > ALTURA_MAXIMA) {
    throw new Error('O orçamento tem fórmulas demais para uma única imagem.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = LARGURA;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Não foi possível montar a imagem.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LARGURA, altura);
  ctx.drawImage(topo, 0, 0, LARGURA, alturaTopo);

  let y = alturaTopo + 24;
  ctx.fillStyle = '#111111';
  ctx.textBaseline = 'top';
  ctx.strokeStyle = '#111111';
  for (const linha of quebradas) {
    if (linha.separador) {
      ctx.save();
      ctx.strokeStyle = '#9aa0a6';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(PADDING, y + 8);
      ctx.lineTo(LARGURA - PADDING, y + 8);
      ctx.stroke();
      ctx.restore();
      y += linha.altura;
      continue;
    }
    let x = PADDING;
    for (const trecho of linha.trechos) {
      ctx.font = `${trecho.peso} ${linha.tamanho}px "Segoe UI", Arial, sans-serif`;
      ctx.fillStyle = '#111111';
      ctx.fillText(trecho.texto, x, y);
      const largura = ctx.measureText(trecho.texto).width;
      if (trecho.sublinhado && trecho.texto.trim()) {
        const base = y + linha.tamanho + 1;
        ctx.beginPath();
        ctx.strokeStyle = '#111111';
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.moveTo(x, base);
        ctx.lineTo(x + largura, base);
        ctx.stroke();
      }
      x += largura;
    }
    y += linha.altura;
  }

  ctx.drawImage(rodape, 0, alturaTopo + alturaMiolo, LARGURA, alturaRodape);
  return canvasParaPng(canvas);
}

export interface LinhaTextoOrcamentoImagem {
  texto: string;
  peso: '400' | '700';
  separador: boolean;
  tamanho: number;
  altura: number;
}

/** Mesmas linhas desenhadas no PNG, para conferir o texto antes da imagem. */
export function linhasTextoOrcamentoImagem(
  dados: OrcamentoImagem,
): LinhaTextoOrcamentoImagem[] {
  return montarLinhas(dados).map((linha) =>
    linha.tipo === 'traco'
      ? { texto: '', peso: '400' as const, separador: true, tamanho: 16, altura: linha.altura }
      : {
          texto: linha.texto ?? '',
          peso: linha.peso ?? '400',
          separador: false,
          tamanho: linha.tamanho ?? 16,
          altura: linha.altura,
        },
  );
}

function montarLinhas(dados: OrcamentoImagem): LinhaDesenho[] {
  const linhas: LinhaDesenho[] = [
    texto(`PACIENTE: ${dados.paciente || '—'}`, '700', 18, 28),
    texto(`ORÇAMENTO: ${dados.nrorc}`, '700', 18, 32),
  ];

  dados.formulas.forEach((formula, indice) => {
    linhas.push(texto(`FÓRMULA ${formula.serieo}`, '700', 16, 24));
    linhas.push(texto('ATIVOS:', '700', 15, 22));
    if (formula.ativos.length === 0) {
      linhas.push(texto('- Sem ativos informados', '400', 15, 22));
    } else {
      for (const ativo of formula.ativos) {
        linhas.push(texto(`- ${ativo.linha}`, '400', 15, 22));
      }
    }
    linhas.push(texto(formula.embalagem, '400', 15, 24));
    linhas.push(texto(`VALOR: ${dinheiro(formula.valor)}`, '700', 16, 28));
    if (indice < dados.formulas.length - 1) {
      linhas.push({ tipo: 'traco', altura: 22 });
    }
  });

  linhas.push(texto('RESUMO DO ORÇAMENTO:', '700', 16, 26));
  linhas.push(texto(`Subtotal dos Itens: ${dinheiro(dados.subtotal)}`, '400', 15, 22));
  linhas.push(texto(`Desconto Aplicado: ${dinheiro(dados.desconto)}`, '400', 15, 22));
  linhas.push(texto(`TOTAL GERAL: ${dinheiro(dados.total)}`, '700', 16, 30));
  linhas.push(
    texto(
      `Orçamento gerado em: ${dados.geradoEm} - Válido por ${dados.diasValidade} dias`,
      '400',
      14,
      22,
    ),
  );
  return linhas;
}

function texto(
  conteudo: string,
  peso: '400' | '700',
  tamanho: number,
  altura: number,
): LinhaDesenho {
  return { tipo: 'texto', texto: conteudo, peso, tamanho, altura };
}

function linhasDeDados(dados: OrcamentoImagem): LinhaEditadaImagem[] {
  return montarLinhas(dados).map((linha) =>
    linha.tipo === 'traco'
      ? { trechos: [], separador: true, tamanho: 16, altura: linha.altura }
      : {
          trechos: [
            {
              texto: linha.texto ?? '',
              peso: linha.peso ?? '400',
              sublinhado: false,
            },
          ],
          separador: false,
          tamanho: linha.tamanho ?? 16,
          altura: linha.altura,
        },
  );
}

function linhaSimples(texto: string): LinhaEditadaImagem {
  return {
    trechos: [{ texto, peso: '400', sublinhado: false }],
    separador: false,
    tamanho: 16,
    altura: 24,
  };
}

function linhasDoBloco(el: HTMLElement): LinhaEditadaImagem[] {
  const tamanho = Number(el.dataset['tamanho']) || 16;
  const altura = Number(el.dataset['altura']) || tamanho + 8;
  const grupos: TrechoTextoImagem[][] = [[]];
  const andar = (node: Node, negrito: boolean, sublinhado: boolean): void => {
    if (node instanceof HTMLBRElement) {
      grupos.push([]);
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const texto = (node.textContent ?? '').replace(/\u00a0/g, ' ');
      if (texto) {
        grupos[grupos.length - 1].push({
          texto,
          peso: negrito ? '700' : '400',
          sublinhado,
        });
      }
      return;
    }
    if (!(node instanceof HTMLElement) || node.tagName === 'HR') {
      return;
    }
    const forte = negrito || node.tagName === 'B' || node.tagName === 'STRONG';
    const risco = sublinhado || node.tagName === 'U';
    if (node.tagName === 'DIV' || node.tagName === 'P') {
      if (grupos[grupos.length - 1].length > 0) {
        grupos.push([]);
      }
    }
    for (const filho of Array.from(node.childNodes)) {
      andar(filho, forte, risco);
    }
  };
  andar(el, false, false);
  return grupos.map((trechos) => ({ trechos, separador: false, tamanho, altura }));
}

function quebrarLinhaEditada(
  ctx: CanvasRenderingContext2D,
  linha: LinhaEditadaImagem,
  largura: number,
): LinhaEditadaImagem[] {
  const palavras: TrechoTextoImagem[] = [];
  for (const trecho of linha.trechos) {
    const partes = trecho.texto.split(/(\s+)/);
    for (const parte of partes) {
      if (!parte) {
        continue;
      }
      palavras.push({ ...trecho, texto: parte });
    }
  }
  const linhas: TrechoTextoImagem[][] = [];
  let atual: TrechoTextoImagem[] = [];
  let larguraAtual = 0;
  const medir = (trecho: TrechoTextoImagem): number => {
    ctx.font = `${trecho.peso} ${linha.tamanho}px "Segoe UI", Arial, sans-serif`;
    return ctx.measureText(trecho.texto).width;
  };
  for (const palavra of palavras) {
    const larguraPalavra = medir(palavra);
    if (larguraAtual + larguraPalavra > largura && atual.some((item) => item.texto.trim())) {
      linhas.push(atual);
      atual = [];
      larguraAtual = 0;
      if (!palavra.texto.trim()) {
        continue;
      }
    }
    atual.push(palavra);
    larguraAtual += larguraPalavra;
  }
  if (atual.length > 0) {
    linhas.push(atual);
  }
  if (linhas.length === 0) {
    return [{ ...linha, trechos: [] }];
  }
  return linhas.map((trechos) => ({ ...linha, trechos }));
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function alturaProporcional(imagem: HTMLImageElement): number {
  if (!imagem.width) {
    return 120;
  }
  return Math.max(1, Math.round((imagem.height * LARGURA) / imagem.width));
}

function dinheiro(valor: number): string {
  const numero = Number.isFinite(valor) ? valor : 0;
  return `R$ ${numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function canvasParaPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Não foi possível montar a imagem.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

export function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const imagem = new Image();
    imagem.onload = () => resolve(imagem);
    imagem.onerror = () => reject(new Error('Não foi possível ler a faixa da imagem.'));
    imagem.src = url;
  });
}
