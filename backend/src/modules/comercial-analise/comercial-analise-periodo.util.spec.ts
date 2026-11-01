import { periodoCompetencia } from '../visitacao-acompanhamento/utils/visitacao-dias-uteis.util';
import {
  listarCompetenciasAnalise,
  semanasCandidatasHome,
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

  it('candidatas da home incluem mês anterior + prévia do corrente', () => {
    const hoje = '2026-11-01';
    const semanas = semanasCandidatasHome(hoje);
    expect(semanas[0].inicio).toBe('2026-10-01');
    expect(semanas[semanas.length - 1].label).toBe('1 a 1 de Nov (prévia)');
    expect(semanas.some((s) => s.fim === '2026-10-31')).toBe(true);
  });
});
