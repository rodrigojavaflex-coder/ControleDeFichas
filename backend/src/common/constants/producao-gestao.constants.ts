/** Código fixo da etapa manual de gestão (não vem do ERP). */
export const PRODUCAO_COD_ETAPA_GESTAO = 'GESTAO';

export const PRODUCAO_NOME_ETAPA_GESTAO = 'GESTÃO';

export enum ProducaoEtapaTipoCalculo {
  ERP = 'erp',
  GESTAO = 'gestao',
  CERTIFICADO = 'certificado',
}

/** Código fixo da etapa manual de certificado de análise (não vem do FC12500). */
export const PRODUCAO_COD_ETAPA_CERTIFICADOS = 'CERTIFICADOS';

export const PRODUCAO_NOME_ETAPA_CERTIFICADOS = 'CERTIFICADOS';

export function isCodEtapaCertificados(codEtapa: string): boolean {
  return codEtapa === PRODUCAO_COD_ETAPA_CERTIFICADOS;
}

export function isCodEtapaGestao(codEtapa: string): boolean {
  return codEtapa === PRODUCAO_COD_ETAPA_GESTAO;
}
