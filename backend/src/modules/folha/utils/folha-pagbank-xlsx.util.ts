import * as ExcelJS from 'exceljs';

export type LinhaPagamentoPagbank = {
  bancoNumero: string;
  contaBancaria: string;
  digitoConta: string;
  nomeFavorecido: string;
  cpfCnpj: string;
  valor: number;
};

/** Nome do modelo PagBank: apenas letras (Unicode) e espaços. */
export function sanitizarNomeFavorecidoPagbank(nome: string): string {
  return nome
    .normalize('NFKC')
    .replace(/[^\p{L}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('pt-BR');
}

export function somenteDigitos(valor: string | null | undefined): string {
  return String(valor ?? '').replace(/\D/g, '');
}

/**
 * Gera XLSX no layout do modelo PagBank Folha de Pagamento v2.0
 * (somente aba «Folha de Pagamento»).
 */
export async function gerarWorkbookPagbankFolha(
  linhas: LinhaPagamentoPagbank[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'NEST_ANGULAR';
  wb.created = new Date();

  const ws = wb.addWorksheet('Folha de Pagamento', {
    views: [{ state: 'normal', showGridLines: true }],
  });

  const fontTitle = { name: 'Arial', size: 20, bold: true };
  const fontSubtitle = { name: 'Arial', size: 14, bold: true };
  const fontBold = { name: 'Arial', size: 10, bold: true };
  const fontNormal = { name: 'Arial', size: 10, bold: false };
  const moedaFmt = '[$R$-416] #,##0.00;[Red]\\-[$R$-416] #,##0.00';
  const textoFmt = '@';

  ws.mergeCells('A1:G1');
  ws.getCell('A1').font = fontTitle;

  ws.mergeCells('A2:G2');
  ws.getCell('A2').value = 'Folha de Pagamento - Arquivo Modelo';
  ws.getCell('A2').font = fontSubtitle;

  ws.getCell('A3').value = 'VALOR TOTAL';
  ws.getCell('A3').font = fontBold;
  ws.getCell('B3').value = { formula: 'SUM(F:F)' };
  ws.getCell('B3').font = fontBold;
  ws.getCell('B3').numFmt = moedaFmt;
  ws.getCell('F3').value = 'Versão 2.0';
  ws.getCell('F3').font = fontNormal;

  ws.getCell('A4').value = 'QUANTIDADE';
  ws.getCell('A4').font = fontBold;
  ws.getCell('B4').value = { formula: 'COUNTA(A7:A999999)' };
  ws.getCell('B4').font = fontBold;

  ws.mergeCells('A5:C5');

  const headers = [
    'CÓDIGO BANCO FAVORECIDO',
    'CONTA FAVORECIDO',
    'DÍGITO CONTA FAVORECIDO',
    'NOME FAVORECIDO',
    'CNPJ/CPF DO FAVORECIDO',
    'VALOR DO PAGAMENTO',
  ];
  headers.forEach((h, i) => {
    const cell = ws.getCell(6, i + 1);
    cell.value = h;
    cell.font = fontBold;
    if (i === 4) cell.numFmt = textoFmt;
  });

  linhas.forEach((linha, idx) => {
    const row = 7 + idx;
    ws.getCell(row, 1).value = linha.bancoNumero;
    ws.getCell(row, 1).numFmt = textoFmt;
    ws.getCell(row, 1).font = fontNormal;

    ws.getCell(row, 2).value = linha.contaBancaria;
    ws.getCell(row, 2).numFmt = textoFmt;
    ws.getCell(row, 2).font = fontNormal;

    ws.getCell(row, 3).value = linha.digitoConta;
    ws.getCell(row, 3).numFmt = textoFmt;
    ws.getCell(row, 3).font = fontNormal;

    ws.getCell(row, 4).value = linha.nomeFavorecido;
    ws.getCell(row, 4).numFmt = textoFmt;
    ws.getCell(row, 4).font = fontNormal;

    ws.getCell(row, 5).value = linha.cpfCnpj;
    ws.getCell(row, 5).numFmt = textoFmt;
    ws.getCell(row, 5).font = fontNormal;

    ws.getCell(row, 6).value = Number(linha.valor.toFixed(2));
    ws.getCell(row, 6).numFmt = moedaFmt;
    ws.getCell(row, 6).font = fontNormal;
  });

  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 26;
  ws.getColumn(4).width = 36;
  ws.getColumn(5).width = 26;
  ws.getColumn(6).width = 22;

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
