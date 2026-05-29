import { Injectable } from '@nestjs/common';
import { Resvg } from '@resvg/resvg-js';
import { FolhaCapaDetalheDto } from '../folha/folha-capas.service';
import { FolhaMovimentoTipo } from '../../common/enums/folha-movimento-tipo.enum';

/** Item de capa com verba (mesma forma usada no recibo de impressão). */
type ItemCapaRecibo = NonNullable<
  NonNullable<FolhaCapaDetalheDto['capa']['itens']>[number]
>;

const MESES_PT: readonly string[] = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

/** Cores e medidas alinhadas a `estilosReciboPagamento` no frontend. */
const LAYOUT = {
  width: 580,
  blocosWidth: 540,
  blocosX: 20,
  bannerRec: '#3d5530',
  bannerDesc: '#c41e3a',
  borderSec: '#cfd4dc',
  stripeA: '#ffffff',
  stripeB: '#f3f4f6',
  rowBorder: '#e5e7eb',
  totalRowBg: '#e5e7eb',
  totalRowBorder: '#9ca3af',
  liqBorder: '#1f2937',
  liqBg: '#fafafa',
  liqBox: '#ff9800',
  liqBoxBorder: '#e65100',
  text: '#212529',
  textMuted: '#495057',
  bannerH: 40,
  rowH: 38,
  padX: 14,
  radius: 4,
} as const;

@Injectable()
export class FolhaReciboImagemService {
  gerarNomeArquivo(nome: string, mes: number, ano: number): string {
    const base = (nome || 'funcionario')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
    return `recibo-${base || 'funcionario'}-${String(mes).padStart(2, '0')}-${ano}.png`;
  }

  /**
   * PNG do recibo — layout idêntico ao impresso em `montarCorpoHtmlReciboPagamento`.
   * @param impressoPor Nome do usuário (rodapé), como na impressão.
   */
  gerarReciboPng(detalhe: FolhaCapaDetalheDto, impressoPor = 'Sistema'): Buffer {
    const capa = detalhe.capa;
    const funcionario = (capa.funcionario?.nome ?? '').trim() || '—';
    const refMensal = `${this.nomeMesPt(capa.mes)}/${capa.ano}`;
    const itensReceitas = this.itensPorTipo(capa.itens, FolhaMovimentoTipo.RECEITA);
    const itensDespesas = this.itensPorTipo(capa.itens, FolhaMovimentoTipo.DESPESA);

    const secRecH = this.alturaSecao(itensReceitas.length || 1);
    const secDescH = this.alturaSecao(itensDespesas.length || 1);
    const headerH = 118;
    const gapSec = 14;
    const liqH = 72;
    const footerH = 48;
    const padTop = 16;
    const height =
      padTop + headerH + gapSec + secRecH + gapSec + secDescH + gapSec + liqH + footerH;

    let y = padTop;
    const parts: string[] = [];
    const font = 'Arial, Helvetica, sans-serif';
    const bx = LAYOUT.blocosX;
    const bw = LAYOUT.blocosWidth;
    const cx = LAYOUT.width / 2;

    parts.push(`<rect width="100%" height="100%" fill="#ffffff"/>`);

    // Cabeçalho centralizado
    y += 28;
    parts.push(
      `<text x="${cx}" y="${y}" font-family="${font}" font-size="28" font-weight="700" fill="#111" text-anchor="middle">Recibo de Pagamento</text>`,
    );
    y += 28;
    parts.push(
      `<text x="${cx}" y="${y}" font-family="${font}" font-size="18" font-weight="600" fill="#111" text-anchor="middle">Folha mensal referente a ${this.escapeXml(refMensal)}</text>`,
    );
    y += 26;
    parts.push(
      `<text x="${cx}" y="${y}" font-family="${font}" font-size="20" font-weight="600" fill="#111" text-anchor="middle">${this.escapeXml(funcionario)}</text>`,
    );

    y = padTop + headerH + gapSec;
    y = this.desenharSecao(
      parts,
      y,
      'RECEITAS',
      LAYOUT.bannerRec,
      itensReceitas,
      'Nenhuma receita nesta folha.',
      'TOTAL',
      detalhe.totalReceitas,
    );

    y += gapSec;
    y = this.desenharSecao(
      parts,
      y,
      'DESCONTOS',
      LAYOUT.bannerDesc,
      itensDespesas,
      'Nenhum desconto nesta folha.',
      'TOTAL DOS DESCONTOS',
      detalhe.totalDespesas,
    );

    y += gapSec;
    parts.push(...this.desenharLiquido(y, detalhe.liquido));

    const footerY = height - 22;
    const geradoEm = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
    parts.push(
      `<text x="${cx}" y="${footerY}" font-family="${font}" font-size="14" fill="${LAYOUT.textMuted}" text-anchor="middle">Documento gerado em ${this.escapeXml(geradoEm)} · Impresso por: ${this.escapeXml(impressoPor)}</text>`,
    );

    const svg = `<svg width="${LAYOUT.width}" height="${height}" viewBox="0 0 ${LAYOUT.width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${parts.join('\n')}
    </svg>`;

    const resvg = new Resvg(svg, { fitTo: { mode: 'original' } });
    return resvg.render().asPng();
  }

  private alturaSecao(qtdLinhas: number): number {
    const linhas = Math.max(qtdLinhas, 1);
    return LAYOUT.bannerH + linhas * LAYOUT.rowH + LAYOUT.rowH;
  }

  private desenharSecao(
    parts: string[],
    y: number,
    tituloBanner: string,
    corBanner: string,
    itens: ItemCapaRecibo[],
    msgVazio: string,
    rotuloTotal: string,
    total: number,
  ): number {
    const font = 'Arial, Helvetica, sans-serif';
    const bx = LAYOUT.blocosX;
    const bw = LAYOUT.blocosWidth;
    const linhas = itens.length ? itens : null;
    const qtdRows = linhas ? linhas.length : 1;
    const secH = LAYOUT.bannerH + qtdRows * LAYOUT.rowH + LAYOUT.rowH;

    parts.push(
      `<rect x="${bx}" y="${y}" width="${bw}" height="${secH}" rx="${LAYOUT.radius}" fill="none" stroke="${LAYOUT.borderSec}" stroke-width="1"/>`,
    );
    parts.push(
      `<rect x="${bx}" y="${y}" width="${bw}" height="${LAYOUT.bannerH}" fill="${corBanner}"/>`,
    );
    parts.push(
      `<text x="${bx + bw / 2}" y="${y + 26}" font-family="${font}" font-size="16" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="2">${tituloBanner}</text>`,
    );

    let rowY = y + LAYOUT.bannerH;
    if (linhas) {
      linhas.forEach((it, idx) => {
        const bg = idx % 2 === 0 ? LAYOUT.stripeA : LAYOUT.stripeB;
        parts.push(...this.desenharLinhaTabela(rowY, bg, it.folhaVerba?.descricao ?? 'Evento', it.valor, false));
        rowY += LAYOUT.rowH;
      });
    } else {
      parts.push(...this.desenharLinhaVazia(rowY, msgVazio));
      rowY += LAYOUT.rowH;
    }

    parts.push(
      `<line x1="${bx}" y1="${rowY}" x2="${bx + bw}" y2="${rowY}" stroke="${LAYOUT.totalRowBorder}" stroke-width="2"/>`,
    );
    parts.push(...this.desenharLinhaTabela(rowY, LAYOUT.totalRowBg, rotuloTotal, total, true));

    return y + secH;
  }

  private desenharLinhaTabela(
    rowY: number,
    bg: string,
    descricao: string,
    valor: unknown,
    isTotal: boolean,
  ): string[] {
    const font = 'Arial, Helvetica, sans-serif';
    const bx = LAYOUT.blocosX;
    const bw = LAYOUT.blocosWidth;
    const valX = bx + bw - LAYOUT.padX;
    const descX = bx + LAYOUT.padX;
    const weight = isTotal ? '800' : '500';
    const valWeight = '700';
    const textY = rowY + 25;

    return [
      `<rect x="${bx + 1}" y="${rowY}" width="${bw - 2}" height="${LAYOUT.rowH}" fill="${bg}"/>`,
      `<line x1="${bx}" y1="${rowY + LAYOUT.rowH}" x2="${bx + bw}" y2="${rowY + LAYOUT.rowH}" stroke="${LAYOUT.rowBorder}" stroke-width="1"/>`,
      `<text x="${descX}" y="${textY}" font-family="${font}" font-size="16" font-weight="${weight}" fill="${LAYOUT.text}">${this.escapeXml(descricao)}</text>`,
      `<text x="${valX}" y="${textY}" font-family="${font}" font-size="16" font-weight="${valWeight}" fill="${LAYOUT.text}" text-anchor="end">${this.escapeXml(this.moeda(valor))}</text>`,
    ];
  }

  private desenharLinhaVazia(rowY: number, msg: string): string[] {
    const font = 'Arial, Helvetica, sans-serif';
    const bx = LAYOUT.blocosX;
    const bw = LAYOUT.blocosWidth;
    const cx = bx + bw / 2;
    return [
      `<rect x="${bx + 1}" y="${rowY}" width="${bw - 2}" height="${LAYOUT.rowH}" fill="${LAYOUT.stripeA}"/>`,
      `<line x1="${bx}" y1="${rowY + LAYOUT.rowH}" x2="${bx + bw}" y2="${rowY + LAYOUT.rowH}" stroke="${LAYOUT.rowBorder}" stroke-width="1"/>`,
      `<text x="${cx}" y="${rowY + 25}" font-family="${font}" font-size="16" fill="#64748b" font-style="italic" text-anchor="middle">${this.escapeXml(msg)}</text>`,
    ];
  }

  private desenharLiquido(y: number, liquido: number): string[] {
    const font = 'Arial, Helvetica, sans-serif';
    const bx = LAYOUT.blocosX;
    const bw = LAYOUT.blocosWidth;
    const h = 72;
    const moedaStr = this.moeda(liquido);
    const boxPadX = 20;
    const boxPadY = 12;
    const fontSize = 32;
    const boxW = Math.max(160, moedaStr.length * 18 + boxPadX * 2);
    const boxH = fontSize + boxPadY * 2;
    const boxX = bx + bw - boxW - LAYOUT.padX;
    const boxY = y + (h - boxH) / 2;

    return [
      `<rect x="${bx}" y="${y}" width="${bw}" height="${h}" fill="${LAYOUT.liqBg}" stroke="${LAYOUT.liqBorder}" stroke-width="2"/>`,
      `<text x="${bx + LAYOUT.padX}" y="${y + h / 2 + 10}" font-family="${font}" font-size="26" font-weight="900" fill="#111">TOTAL LÍQUIDO</text>`,
      `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="4" fill="${LAYOUT.liqBox}" stroke="${LAYOUT.liqBoxBorder}" stroke-width="3"/>`,
      `<text x="${boxX + boxW / 2}" y="${boxY + boxH / 2 + 11}" font-family="${font}" font-size="${fontSize}" font-weight="900" fill="#111" text-anchor="middle">${this.escapeXml(moedaStr)}</text>`,
    ];
  }

  private itensPorTipo(
    itens: FolhaCapaDetalheDto['capa']['itens'] | undefined,
    tipo: FolhaMovimentoTipo,
  ): ItemCapaRecibo[] {
    return [...(itens ?? [])]
      .filter((it) => it.folhaVerba?.tipoMovimento === tipo)
      .sort((a, b) =>
        (a.folhaVerba?.descricao ?? '').localeCompare(b.folhaVerba?.descricao ?? '', 'pt-BR'),
      );
  }

  private nomeMesPt(mes: number): string {
    return MESES_PT[mes] ?? String(mes);
  }

  private moeda(valor: unknown): string {
    const num = Number(String(valor ?? '0').replace(',', '.'));
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(Number.isFinite(num) ? num : 0);
  }

  private escapeXml(input: string): string {
    return String(input)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
