/** Código fixo da etapa manual de gestão (não vem do ERP). */
export const PRODUCAO_COD_ETAPA_GESTAO = 'GESTAO';

export const PRODUCAO_NOME_ETAPA_GESTAO = 'GESTÃO';

export enum ProducaoEtapaTipoCalculo {
  ERP = 'erp',
  GESTAO = 'gestao',
}

export function isCodEtapaGestao(codEtapa: string): boolean {
  return codEtapa === PRODUCAO_COD_ETAPA_GESTAO;
}
