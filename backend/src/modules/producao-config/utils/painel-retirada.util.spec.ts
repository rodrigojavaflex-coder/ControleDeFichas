import {
  ProducaoPainelAlertaCor,
  ProducaoPainelAlertaTipo,
} from '../entities/producao-painel-alerta-retirada.entity';
import {
  classificarCorPainelRetirada,
  minutosParaRetirada,
  minutosParaRetiradaCorrido,
  requisicaoFormulaConcluidaPainel,
} from './painel-retirada.util';

describe('painel-retirada.util', () => {
  const alertas = [
    {
      tipo: ProducaoPainelAlertaTipo.ANTES,
      minutosAntes: 300,
      cor: '#EAB308',
      rotulo: '5 horas',
    },
    {
      tipo: ProducaoPainelAlertaTipo.ANTES,
      minutosAntes: 120,
      cor: '#F97316',
      rotulo: '2 horas',
    },
    {
      tipo: ProducaoPainelAlertaTipo.ATRASADO,
      minutosAntes: null,
      cor: '#DC2626',
      rotulo: 'Atrasado',
    },
  ];

  it('classifica faixas antes da retirada', () => {
    expect(classificarCorPainelRetirada(250, alertas)).toBe('#EAB308');
    expect(classificarCorPainelRetirada(100, alertas)).toBe('#F97316');
    expect(classificarCorPainelRetirada(400, alertas)).toBe(
      ProducaoPainelAlertaCor.NEUTRO,
    );
  });

  it('classifica atrasado', () => {
    expect(classificarCorPainelRetirada(-5, alertas)).toBe('#DC2626');
  });

  it('calcula minutos corrido até retirada', () => {
    const agora = new Date('2026-08-05T10:00:00-03:00');
    const min = minutosParaRetiradaCorrido('2026-08-05', '12:00', agora);
    expect(min).toBe(120);
  });

  it('minutosParaRetirada usa corrido sem jornada útil', () => {
    const agora = new Date('2026-08-05T10:00:00-03:00');
    expect(minutosParaRetirada('2026-08-05', '12:00', agora, null)).toBe(120);
    expect(
      minutosParaRetirada('2026-08-05', '12:00', agora, {
        configurado: false,
        intervalosPorDia: new Map(),
        feriados: new Set(),
      }),
    ).toBe(120);
  });

  it('concluída quando dataSaida em pelo menos uma etapa final configurada', () => {
    const finais = new Set(['10', '20']);
    expect(
      requisicaoFormulaConcluidaPainel(
        [
          { codEtapa: '5', dataSaida: null },
          { codEtapa: '10', dataSaida: '2026-08-01' },
        ],
        finais,
      ),
    ).toBe(true);
    expect(
      requisicaoFormulaConcluidaPainel(
        [{ codEtapa: '10', dataSaida: null }],
        finais,
      ),
    ).toBe(false);
    expect(
      requisicaoFormulaConcluidaPainel(
        [{ codEtapa: '99', dataSaida: '2026-08-01' }],
        finais,
      ),
    ).toBe(false);
    expect(requisicaoFormulaConcluidaPainel([], finais)).toBe(false);
    expect(
      requisicaoFormulaConcluidaPainel(
        [{ codEtapa: '10', dataSaida: '2026-08-01' }],
        [],
      ),
    ).toBe(false);
  });
});
