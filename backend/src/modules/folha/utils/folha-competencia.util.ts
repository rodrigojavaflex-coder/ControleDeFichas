const MESES_PT = [
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
] as const;

export function nomeMesPt(mes: number): string {
  if (mes >= 1 && mes <= 12) {
    return MESES_PT[mes - 1];
  }
  return String(mes);
}

/** Converte ano/mês (competência) em inteiro comparable (ordem cronológica). */
export function competenciaParaIndice(ano: number, mes: number): number {
  return ano * 12 + mes;
}

/**
 * Normaliza data vinda do cadastro / TypeORM / PG (`date`, string `YYYY-MM-DD`, ISO com hora, `Date`).
 * Evita falha de elegibilidade quando `Date` em memória vira `toString()` não ISO (ex.: "Wed May 01...").
 */
export function normalizarDataCadastroParaIso(val: unknown): string | null {
  if (val == null) return null;
  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return null;
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val !== 'string' && typeof val !== 'number') {
    return null;
  }
  const s = String(val).trim();
  if (!s) return null;
  const head = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (head) return head[1];
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

/** Dados do cadastro mínimos para elegibilidade de nova capa (RN-011 / RN-005). */
export type FolhaCadastroDatasParaElegibilidade = {
  ativo: boolean;
  participaFolhaPagamento?: boolean;
  dataAdmissao?: unknown;
  dataDemissao?: unknown;
};

export enum FolhaMotivoInelegivelNovaCapa {
  ELEGIVEL = 'ELEGIVEL',
  INATIVO = 'INATIVO',
  NAO_PARTICIPA_FOLHA = 'NAO_PARTICIPA_FOLHA',
  ADMISSAO_AUSENTE = 'ADMISSAO_AUSENTE',
  ADMISSAO_POSTERIOR = 'ADMISSAO_POSTERIOR',
  DEMISSAO_NA_COMPETENCIA_OU_POSTERIOR = 'DEMISSAO_NA_COMPETENCIA_OU_POSTERIOR',
  DEMISSAO_INVALIDA = 'DEMISSAO_INVALIDA',
  ERRO_DATAS = 'ERRO_DATAS',
}

export type FolhaAvaliacaoElegibilidadeNovaCapa = {
  elegivel: boolean;
  motivo: FolhaMotivoInelegivelNovaCapa;
};

function participaFolhaPagamentoEfetivo(f: FolhaCadastroDatasParaElegibilidade): boolean {
  return f.participaFolhaPagamento !== false;
}

/**
 * Avalia critérios para **criar/listar capa** na competência (RN-011 / RN-005).
 */
export function avaliarElegibilidadeNovaCapaNaCompetencia(
  f: FolhaCadastroDatasParaElegibilidade,
  ano: number,
  mes: number,
): FolhaAvaliacaoElegibilidadeNovaCapa {
  if (!f.ativo) {
    return { elegivel: false, motivo: FolhaMotivoInelegivelNovaCapa.INATIVO };
  }
  if (!participaFolhaPagamentoEfetivo(f)) {
    return {
      elegivel: false,
      motivo: FolhaMotivoInelegivelNovaCapa.NAO_PARTICIPA_FOLHA,
    };
  }
  const da = normalizarDataCadastroParaIso(f.dataAdmissao);
  if (!da) {
    return {
      elegivel: false,
      motivo: FolhaMotivoInelegivelNovaCapa.ADMISSAO_AUSENTE,
    };
  }
  const alvoIndice = competenciaParaIndice(ano, mes);
  try {
    const ia = periodoApartirDaDataIso(da);
    if (ia > alvoIndice) {
      return {
        elegivel: false,
        motivo: FolhaMotivoInelegivelNovaCapa.ADMISSAO_POSTERIOR,
      };
    }
    if (!f.dataDemissao) {
      return { elegivel: true, motivo: FolhaMotivoInelegivelNovaCapa.ELEGIVEL };
    }
    const demIso = normalizarDataCadastroParaIso(f.dataDemissao);
    if (!demIso) {
      return {
        elegivel: false,
        motivo: FolhaMotivoInelegivelNovaCapa.DEMISSAO_INVALIDA,
      };
    }
    const dem = periodoApartirDaDataIso(demIso);
    if (alvoIndice >= dem) {
      return {
        elegivel: false,
        motivo: FolhaMotivoInelegivelNovaCapa.DEMISSAO_NA_COMPETENCIA_OU_POSTERIOR,
      };
    }
    return { elegivel: true, motivo: FolhaMotivoInelegivelNovaCapa.ELEGIVEL };
  } catch {
    return { elegivel: false, motivo: FolhaMotivoInelegivelNovaCapa.ERRO_DATAS };
  }
}

export function funcionarioElegivelNovaCapaNaCompetencia(
  f: FolhaCadastroDatasParaElegibilidade,
  ano: number,
  mes: number,
): boolean {
  return avaliarElegibilidadeNovaCapaNaCompetencia(f, ano, mes).elegivel;
}

const MENSAGENS_INELEGIVEL: Record<
  Exclude<FolhaMotivoInelegivelNovaCapa, FolhaMotivoInelegivelNovaCapa.ELEGIVEL>,
  string
> = {
  [FolhaMotivoInelegivelNovaCapa.INATIVO]:
    'Funcionário inativo não pode ter nova folha nesta competência.',
  [FolhaMotivoInelegivelNovaCapa.NAO_PARTICIPA_FOLHA]:
    'Funcionário marcado como não participante da folha de pagamento. Não é permitido novo lançamento.',
  [FolhaMotivoInelegivelNovaCapa.ADMISSAO_AUSENTE]:
    'Data de admissão obrigatória para lançamento de folha.',
  [FolhaMotivoInelegivelNovaCapa.ADMISSAO_POSTERIOR]:
    'A competência é anterior ao mês/ano de admissão do funcionário. Não é permitido novo lançamento.',
  [FolhaMotivoInelegivelNovaCapa.DEMISSAO_NA_COMPETENCIA_OU_POSTERIOR]:
    'A competência é igual ou posterior ao mês/ano da demissão. Não é permitido novo lançamento.',
  [FolhaMotivoInelegivelNovaCapa.DEMISSAO_INVALIDA]:
    'Não foi possível validar a data de demissão para esta competência.',
  [FolhaMotivoInelegivelNovaCapa.ERRO_DATAS]:
    'Não foi possível validar datas de admissão/demissão para esta competência.',
};

/** Mensagem funcional para API ao bloquear criação de `folha_capa`. */
export function mensagemErroNovaCapaNaCompetencia(
  f: FolhaCadastroDatasParaElegibilidade,
  ano: number,
  mes: number,
): string {
  const { elegivel, motivo } = avaliarElegibilidadeNovaCapaNaCompetencia(
    f,
    ano,
    mes,
  );
  if (elegivel) {
    return 'Funcionário elegível para nova folha nesta competência.';
  }
  if (motivo === FolhaMotivoInelegivelNovaCapa.ELEGIVEL) {
    return MENSAGENS_INELEGIVEL[FolhaMotivoInelegivelNovaCapa.ERRO_DATAS];
  }
  return MENSAGENS_INELEGIVEL[motivo];
}

/**
 * Produtividade (RN-PCP-005): exibe funcionário na competência do período consultado
 * quando não há demissão ou o mês/ano da demissão é **≥** mês/ano de `dataInicio`
 * (ex.: demissão 30/06/2026 não aparece em consulta com início em 01/07/2026).
 */
export function funcionarioElegivelProdutividadeNoPeriodo(
  f: Pick<FolhaCadastroDatasParaElegibilidade, 'dataDemissao'>,
  dataInicio: string,
): boolean {
  if (!f.dataDemissao) return true;
  const demIso = normalizarDataCadastroParaIso(f.dataDemissao);
  if (!demIso) return true;
  try {
    const demIndice = periodoApartirDaDataIso(demIso);
    const alvoIndice = periodoApartirDaDataIso(dataInicio);
    return demIndice >= alvoIndice;
  } catch {
    return false;
  }
}

/** Espera string de data ISO YYYY-MM-DD (ou com hora ISO). */
export function periodoApartirDaDataIso(isoDate: string): number {
  const dia = isoDate.includes('T')
    ? isoDate.split('T')[0]
    : isoDate.substring(0, 10);
  const [y, m] = dia.split('-').map((n) => parseInt(n, 10));
  if (!y || !m) {
    throw new Error('Data inválida para período ano/mês');
  }
  return competenciaParaIndice(y, m);
}
