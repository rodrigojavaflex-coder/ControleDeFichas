import { periodoCompetencia } from '../visitacao-acompanhamento/utils/visitacao-dias-uteis.util';
import {
  listarCompetenciasAnalise,
  parSemanasComparacaoHome,
  parSemanasFechadasHome,
  rotuloIntervaloHome,
  semanasDaCompetencia,
  semanasMesCorrente,
} from './comercial-analise-periodo.util';

function uniaoCobre(
  partes: Array<{ inicio: string; fim: string }>,
  inicio: string,
  fim: string,
): boolean {
  if (!partes.length) return false;
  const ordenadas = [...partes].sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (ordenadas[0].inicio !== inicio) return false;
  if (ordenadas[ordenadas.length - 1].fim !== fim) return false;
  for (let i = 1; i < ordenadas.length; i += 1) {
    const anterior = ordenadas[i - 1].fim;
    const [y, m, d] = anterior.split('-').map(Number);
    const proximo = new Date(Date.UTC(y, m - 1, d + 1))
      .toISOString()
      .slice(0, 10);
    if (ordenadas[i].inicio !== proximo) return false;
  }
  return true;
}

describe('comercial-analise-periodo', () => {
  it('não inclui mês futuro e marca o corrente como prévia', () => {
    const lista = listarCompetenciasAnalise('2026-10-31');
    expect(lista[0].key).toBe('2026-01');
    expect(lista[lista.length - 1].key).toBe('2026-10');
    expect(lista[lista.length - 1].previa).toBe(true);
    expect(lista.some((c) => c.key === '2026-11')).toBe(false);
    expect(lista.filter((c) => c.previa)).toHaveLength(1);
  });

  it('semana prévia termina hoje e a soma cobre o mês', () => {
    const hoje = '2026-10-08';
    const semanas = semanasMesCorrente(hoje);
    const mes = periodoCompetencia(2026, 10);
    expect(semanas.map((s) => s.label)).toEqual([
      '1 a 4 de Out',
      '5 a 8 de Out (prévia)',
    ]);
    expect(semanas.every((s) => s.inicio <= hoje)).toBe(true);
    expect(semanas[semanas.length - 1].previa).toBe(true);
    expect(semanas[semanas.length - 1].fim).toBe(hoje);
    expect(
      uniaoCobre(
        semanas.map((s) => ({ inicio: s.inicio, fim: s.fim })),
        mes.dataInicial,
        hoje,
      ),
    ).toBe(true);
    expect(
      uniaoCobre(
        semanas.map((s) => ({ inicio: s.inicio, fim: s.fimRejeitado })),
        mes.dataInicial,
        mes.dataFinal,
      ),
    ).toBe(true);
  });

  it('no último dia do mês a venda e o rejeitado fecham o mês inteiro', () => {
    const hoje = '2026-10-31';
    const semanas = semanasMesCorrente(hoje);
    const mes = periodoCompetencia(2026, 10);
    expect(semanas[0].label).toBe('1 a 4 de Out');
    expect(semanas[semanas.length - 1].fim).toBe('2026-10-31');
    expect(semanas[semanas.length - 1].previa).toBe(true);
    expect(
      uniaoCobre(
        semanas.map((s) => ({ inicio: s.inicio, fim: s.fim })),
        mes.dataInicial,
        mes.dataFinal,
      ),
    ).toBe(true);
  });

  it('mês passado fecha todas as semanas sem prévia', () => {
    const hoje = '2026-11-01';
    const semanas = semanasDaCompetencia('2026-10', hoje);
    const mes = periodoCompetencia(2026, 10);
    expect(semanas.every((s) => !s.previa)).toBe(true);
    expect(semanas[semanas.length - 1].fim).toBe('2026-10-31');
    expect(
      uniaoCobre(
        semanas.map((s) => ({ inicio: s.inicio, fim: s.fim })),
        mes.dataInicial,
        mes.dataFinal,
      ),
    ).toBe(true);
  });

  it('rótulo home padroniza dias com zero e mês após o intervalo', () => {
    expect(rotuloIntervaloHome('2026-10-26', '2026-10-31')).toBe('26 a 31 Out');
    expect(rotuloIntervaloHome('2026-10-26', '2026-11-01')).toBe(
      '26 Out a 01 Nov',
    );
    expect(rotuloIntervaloHome('2026-11-02', '2026-11-08')).toBe('02 a 08 Nov');
  });

  it('par da home usa semanas seg–dom sem cortar no mês', () => {
    // terça 03/11/2026 → semana atual seg 02–dom 08 (prévia até 03);
    // anterior seg 26/10–dom 01/11.
    const par = parSemanasComparacaoHome('2026-11-03');
    expect(par).not.toBeNull();
    expect(par!.atual.inicio).toBe('2026-11-02');
    expect(par!.atual.fim).toBe('2026-11-03');
    expect(par!.atual.previa).toBe(true);
    expect(par!.atual.labelCurto).toBe('02 a 08 Nov');
    expect(par!.anterior?.inicio).toBe('2026-10-26');
    expect(par!.anterior?.fim).toBe('2026-11-01');
    expect(par!.anterior?.labelCurto).toBe('26 Out a 01 Nov');
  });

  it('par de semanas fechadas ignora a prévia corrente', () => {
    // terça 03/11/2026 → fechada atual 26/10–01/11; anterior 19/10–25/10.
    const par = parSemanasFechadasHome('2026-11-03');
    expect(par).not.toBeNull();
    expect(par!.atual.inicio).toBe('2026-10-26');
    expect(par!.atual.fim).toBe('2026-11-01');
    expect(par!.atual.previa).toBe(false);
    expect(par!.atual.labelCurto).toBe('26 Out a 01 Nov');
    expect(par!.anterior?.inicio).toBe('2026-10-19');
    expect(par!.anterior?.fim).toBe('2026-10-25');
    expect(par!.anterior?.previa).toBe(false);
    expect(par!.anterior?.labelCurto).toBe('19 a 25 Out');
  });
});
