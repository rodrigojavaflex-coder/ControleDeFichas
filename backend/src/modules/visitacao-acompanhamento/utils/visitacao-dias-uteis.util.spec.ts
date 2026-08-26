import {
  competenciaAberta,
  periodoCompetencia,
  pesoDiaUtilVisitacao,
  somarDiasUteisVisitacao,
  somarPesoDiasVisitacao,
  somarDiasRealizadosVisitacao,
} from './visitacao-dias-uteis.util';

describe('visitacao-dias-uteis', () => {
  it('periodoCompetencia cobre o mês civil', () => {
    expect(periodoCompetencia(2026, 7)).toEqual({
      ano: 2026,
      mes: 7,
      anoMes: '2026-07',
      dataInicial: '2026-07-01',
      dataFinal: '2026-07-31',
    });
    expect(periodoCompetencia(2026, 2).dataFinal).toBe('2026-02-28');
  });

  it('peso: semana, sábado meio dia, feriado zera sábado', () => {
    const nenhum = new Set<string>();
    expect(pesoDiaUtilVisitacao('2026-07-01', false, nenhum)).toBe(1); // qua
    expect(pesoDiaUtilVisitacao('2026-07-05', false, nenhum)).toBe(0); // dom
    expect(pesoDiaUtilVisitacao('2026-07-04', false, nenhum)).toBe(0); // sáb
    expect(pesoDiaUtilVisitacao('2026-07-04', true, nenhum)).toBe(0.5);
    expect(
      pesoDiaUtilVisitacao('2026-07-04', true, new Set(['2026-07-04'])),
    ).toBe(0);
  });

  it('julho/2026 com sábado meio dia soma 23 + 2', () => {
    const du = somarDiasUteisVisitacao(
      '2026-07-01',
      '2026-07-31',
      true,
      new Set(),
    );
    expect(du).toBe(25);
  });

  it('dias realizados: sábado fechado vale 0,5; feriado e domingo zerados', () => {
    expect(
      somarPesoDiasVisitacao(
        ['2026-07-01', '2026-07-04', '2026-07-05'],
        true,
        new Set(),
      ),
    ).toBe(1.5);
    expect(
      somarPesoDiasVisitacao(
        ['2026-07-04', '2026-07-04'],
        true,
        new Set(['2026-07-04']),
      ),
    ).toBe(0);
  });

  it('dias realizados usam o último caixa confirmado (Fechado ou Bloqueado)', () => {
    const nenhum = new Set<string>();
    expect(
      somarDiasRealizadosVisitacao(
        '2026-07-01',
        '2026-07-31',
        '2026-07-23',
        true,
        nenhum,
      ),
    ).toBe(18.5);
    expect(
      somarDiasRealizadosVisitacao(
        '2026-07-01',
        '2026-07-31',
        '2026-07-31',
        true,
        nenhum,
      ),
    ).toBe(25);
    expect(
      somarDiasRealizadosVisitacao(
        '2026-07-01',
        '2026-07-31',
        '2026-08-10',
        true,
        nenhum,
      ),
    ).toBe(25);
    expect(
      somarDiasRealizadosVisitacao(
        '2026-07-01',
        '2026-07-31',
        null,
        true,
        nenhum,
      ),
    ).toBe(0);
  });

  it('competenciaAberta usa o intervalo fechado', () => {
    expect(competenciaAberta('2026-07-15', '2026-07-01', '2026-07-31')).toBe(
      true,
    );
    expect(competenciaAberta('2026-08-01', '2026-07-01', '2026-07-31')).toBe(
      false,
    );
  });
});
