import {
  competenciaAberta,
  periodoCompetencia,
  pesoDiaUtilVisitacao,
  somarDiasUteisVisitacao,
  somarPesoDiasVisitacao,
  somarDiasRealizadosVisitacao,
  ultimoDiaUtilCompetencia,
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

  it('peso: semana, sábado 0,45, feriado zera sábado', () => {
    const nenhum = new Set<string>();
    expect(pesoDiaUtilVisitacao('2026-07-01', false, nenhum)).toBe(1); // qua
    expect(pesoDiaUtilVisitacao('2026-07-05', false, nenhum)).toBe(0); // dom
    expect(pesoDiaUtilVisitacao('2026-07-04', false, nenhum)).toBe(0); // sáb
    expect(pesoDiaUtilVisitacao('2026-07-04', true, nenhum)).toBe(0.45);
    expect(
      pesoDiaUtilVisitacao('2026-07-04', true, new Set(['2026-07-04'])),
    ).toBe(0);
  });

  it('julho/2026 com sábado 0,45 soma 23 + 1,8 = 24,8', () => {
    const du = somarDiasUteisVisitacao(
      '2026-07-01',
      '2026-07-31',
      true,
      new Set(),
    );
    expect(du).toBe(24.8);
  });

  it('agosto e setembro/2026 com sábado 0,45', () => {
    const nenhum = new Set<string>();
    expect(
      somarDiasUteisVisitacao('2026-08-01', '2026-08-31', true, nenhum),
    ).toBe(23.25);
    expect(
      somarDiasUteisVisitacao('2026-09-01', '2026-09-30', true, nenhum),
    ).toBe(23.8);
  });

  it('dias realizados: sábado fechado vale 0,45; feriado e domingo zerados', () => {
    expect(
      somarPesoDiasVisitacao(
        ['2026-07-01', '2026-07-04', '2026-07-05'],
        true,
        new Set(),
      ),
    ).toBe(1.45);
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
    ).toBe(18.35);
    expect(
      somarDiasRealizadosVisitacao(
        '2026-07-01',
        '2026-07-31',
        '2026-07-31',
        true,
        nenhum,
      ),
    ).toBe(24.8);
    expect(
      somarDiasRealizadosVisitacao(
        '2026-07-01',
        '2026-07-31',
        '2026-08-10',
        true,
        nenhum,
      ),
    ).toBe(24.8);
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

  it('ultimoDiaUtilCompetencia: ago/2026 = 31; fev/2026 sem sábado = 27', () => {
    const nenhum = new Set<string>();
    expect(
      ultimoDiaUtilCompetencia('2026-08-01', '2026-08-31', false, nenhum),
    ).toBe('2026-08-31');
    expect(
      ultimoDiaUtilCompetencia('2026-02-01', '2026-02-28', false, nenhum),
    ).toBe('2026-02-27');
    expect(
      ultimoDiaUtilCompetencia('2026-02-01', '2026-02-28', true, nenhum),
    ).toBe('2026-02-28');
  });
});
