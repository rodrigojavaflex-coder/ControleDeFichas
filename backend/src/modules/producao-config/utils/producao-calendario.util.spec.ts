import {
  minutosProducaoEntre,
  type ProducaoCalendarioUnidade,
} from './producao-calendario.util';

describe('minutosProducaoEntre', () => {
  const fim = new Date('2026-08-05T15:00:00-03:00');
  const dataInicio = '2026-08-05';
  const horaInicio = '10:00';

  it('usa tempo corrido quando configurado mas todos os dias sem faixas ativas', () => {
    const cal: ProducaoCalendarioUnidade = {
      configurado: true,
      intervalosPorDia: new Map(),
      feriados: new Set(),
    };
    const minutos = minutosProducaoEntre(dataInicio, horaInicio, fim, cal);
    expect(minutos).toBe(300);
  });

  it('usa faixas quando há ao menos um dia com produção', () => {
    const cal: ProducaoCalendarioUnidade = {
      configurado: true,
      intervalosPorDia: new Map([
        [
          3,
          [{ horaInicio: '08:00', horaFim: '18:00' }],
        ],
      ]),
      feriados: new Set(),
    };
    const minutos = minutosProducaoEntre(dataInicio, horaInicio, fim, cal);
    expect(minutos).toBe(300);
  });

  it('bloco semanal e dia a dia produzem o mesmo total em vários dias', () => {
    const cal: ProducaoCalendarioUnidade = {
      configurado: true,
      intervalosPorDia: new Map([
        [1, [{ horaInicio: '08:00', horaFim: '12:00' }]],
        [2, [{ horaInicio: '08:00', horaFim: '12:00' }]],
        [3, [{ horaInicio: '08:00', horaFim: '12:00' }]],
        [4, [{ horaInicio: '08:00', horaFim: '12:00' }]],
        [5, [{ horaInicio: '08:00', horaFim: '12:00' }]],
      ]),
      feriados: new Set(),
    };
    const inicio = '2026-08-04';
    const fimLongo = new Date('2026-08-25T12:00:00-03:00');
    const minutos = minutosProducaoEntre(inicio, '08:00', fimLongo, cal);
    expect(minutos).toBeGreaterThan(0);
    expect(minutos % 240).toBe(0);
  });
});
