import { parseRpsText } from './rps-pdf.parser';

describe('parseRpsText', () => {
  it('extrai protocolos e valores totais do RPS textual', () => {
    const text = `
DISCRIMINAÇÃO DOS SERVIÇOS
MANIPULACAO DE FORMULAS
47717 001 0035/236022-0 FORMULA C/FOLLICUSAN,3.00%;
1 82,61 82,61
47717 001 0035/236017-0 FORMULA C/SUBCITRATO DE
BISMUTO,240.00MG;
1 95,68 95,68
47717 001 0035/235993-0 FORMULA C/KOH,10.00%;
1 55,05 55,05
VALOR TOTAL DO RPS =
0,00 941,83
5 47,09
941,83
`;

    const itens = parseRpsText(text, 'teste.pdf');
    expect(itens).toHaveLength(3);
    expect(itens[0]).toMatchObject({
      protocolo: '236022',
      valorTotal: 82.61,
      arquivoOrigem: 'teste.pdf',
    });
    expect(itens[1]).toMatchObject({
      protocolo: '236017',
      valorTotal: 95.68,
    });
    expect(itens[2]).toMatchObject({
      protocolo: '235993',
      valorTotal: 55.05,
    });
  });

  it('não interpreta linha de ISS/total como item', () => {
    const text = `
47717 001 0035/236022-0 FORMULA C/FOLLICUSAN,3.00%;
1 82,61 82,61
5 47,09 941,83
`;
    const itens = parseRpsText(text);
    expect(itens).toHaveLength(1);
    expect(itens[0].valorTotal).toBe(82.61);
  });
});
