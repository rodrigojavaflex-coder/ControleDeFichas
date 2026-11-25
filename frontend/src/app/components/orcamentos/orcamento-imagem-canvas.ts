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

export async function desenharOrcamentoImagem(
  dados: OrcamentoImagem,
  topo: HTMLImageElement,
  rodape: HTMLImageElement,
): Promise<Blob> {
  const linhas = montarLinhas(dados);
  const medida = document.createElement('canvas').getContext('2d');
  if (!medida) {
    throw new Error('Não foi possível montar a imagem.');
  }

  const larguraTexto = LARGURA - PADDING * 2;
  const quebradas: LinhaDesenho[] = [];
  for (const linha of linhas) {
    if (linha.tipo === 'traco') {
      quebradas.push(linha);
      continue;
    }
    const partes = quebrarTexto(
      medida,
      linha.texto ?? '',
      larguraTexto,
      linha.peso ?? '400',
      linha.tamanho ?? 16,
    );
    for (const parte of partes) {
      quebradas.push({
        tipo: 'texto',
        texto: parte,
        peso: linha.peso,
        tamanho: linha.tamanho,
        altura: linha.altura,
      });
    }
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
  for (const linha of quebradas) {
    if (linha.tipo === 'traco') {
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
    ctx.font = `${linha.peso ?? '400'} ${linha.tamanho ?? 16}px "Segoe UI", Arial, sans-serif`;
    ctx.fillText(linha.texto ?? '', PADDING, y);
    y += linha.altura;
  }

  ctx.drawImage(rodape, 0, alturaTopo + alturaMiolo, LARGURA, alturaRodape);
  return canvasParaPng(canvas);
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

function quebrarTexto(
  ctx: CanvasRenderingContext2D,
  conteudo: string,
  largura: number,
  peso: '400' | '700',
  tamanho: number,
): string[] {
  ctx.font = `${peso} ${tamanho}px "Segoe UI", Arial, sans-serif`;
  const palavras = conteudo.split(' ');
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of palavras) {
    const candidato = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(candidato).width <= largura) {
      atual = candidato;
      continue;
    }
    if (atual) {
      linhas.push(atual);
    }
    atual = palavra;
  }
  if (atual) {
    linhas.push(atual);
  }
  return linhas.length > 0 ? linhas : [''];
}

function alturaProporcional(imagem: HTMLImageElement): number {
  if (!imagem.width) {
    return 120;
  }
  return Math.max(1, Math.round((imagem.height * LARGURA) / imagem.width));
}

function dinheiro(valor: number): string {
  const numero = Number.isFinite(valor) ? valor : 0;
  return `R$ ${numero.toFixed(2)}`;
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
