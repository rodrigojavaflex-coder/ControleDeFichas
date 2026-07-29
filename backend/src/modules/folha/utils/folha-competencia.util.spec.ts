import {
  FolhaMotivoInelegivelNovaCapa,
  avaliarElegibilidadeNovaCapaNaCompetencia,
  funcionarioElegivelNovaCapaNaCompetencia,
  mensagemErroNovaCapaNaCompetencia,
} from './folha-competencia.util';

describe('folha-competencia.util — elegibilidade nova capa (RN-011)', () => {
  const base = {
    ativo: true,
    participaFolhaPagamento: true,
    dataAdmissao: '2024-01-15',
    dataDemissao: undefined as string | undefined,
  };

  it('aceita competência após admissão', () => {
    expect(
      funcionarioElegivelNovaCapaNaCompetencia(base, 2026, 7),
    ).toBe(true);
  });

  it('rejeita participaFolhaPagamento false mantendo ativo', () => {
    const r = avaliarElegibilidadeNovaCapaNaCompetencia(
      { ...base, participaFolhaPagamento: false },
      2026,
      7,
    );
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe(FolhaMotivoInelegivelNovaCapa.NAO_PARTICIPA_FOLHA);
    expect(
      mensagemErroNovaCapaNaCompetencia(
        { ...base, participaFolhaPagamento: false },
        2026,
        7,
      ),
    ).toContain('não participante');
  });

  it('rejeita competência no mês da demissão', () => {
    const r = avaliarElegibilidadeNovaCapaNaCompetencia(
      { ...base, dataDemissao: '2026-07-30' },
      2026,
      7,
    );
    expect(r.elegivel).toBe(false);
    expect(r.motivo).toBe(
      FolhaMotivoInelegivelNovaCapa.DEMISSAO_NA_COMPETENCIA_OU_POSTERIOR,
    );
  });

  it('aceita competência antes do mês da demissão', () => {
    expect(
      funcionarioElegivelNovaCapaNaCompetencia(
        { ...base, dataDemissao: '2026-07-30' },
        2026,
        6,
      ),
    ).toBe(true);
  });

  it('rejeita competência anterior à admissão', () => {
    expect(
      funcionarioElegivelNovaCapaNaCompetencia(base, 2023, 12),
    ).toBe(false);
  });
});
