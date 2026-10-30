/**
 * Prefixo/profissão do CRM no ERP (FC04000.PFCRM e movimentos).
 * Códigos misturam dígitos e letras — sempre string.
 */
export enum PfCrm {
  MEDICO = '1',
  DENTISTA = '2',
  VETERINARIO = '3',
  ESTETICISTA = '4',
  PSICOLOGA = '5',
  NUTRICIONISTA = '6',
  FARMACEUTICO = '7',
  FONOAUDIOLOGIA = '8',
  PROMOTORA = '9',
  ESTAGIARIA_NUTRICAO = '10',
  FISIOTERAPEUTA = 'A',
  TERAPEUTA = 'B',
  ENFERMEIRO = 'C',
  BIOMEDICO = 'D',
  NATUROLOGO = 'E',
  MASSOTERAPEUTA = 'F',
  DERMATICISTA = 'G',
  DERMOCONSULTORA = 'H',
  REGISTRO_MINISTERIO_SAUDE = 'I',
}

/** Fallback visitação/legado quando o movimento não traz PFCRM. */
export const PF_CRM_PADRAO_VISITACAO = PfCrm.MEDICO;

export const PF_CRM_LABELS: Record<string, string> = {
  [PfCrm.MEDICO]: 'MEDICO',
  [PfCrm.DENTISTA]: 'DENTISTA',
  [PfCrm.VETERINARIO]: 'VETERINARIO',
  [PfCrm.ESTETICISTA]: 'ESTETICISTA',
  [PfCrm.PSICOLOGA]: 'PSICOLOGA',
  [PfCrm.NUTRICIONISTA]: 'NUTRICIONISTA',
  [PfCrm.FARMACEUTICO]: 'FARMACEUTICO',
  [PfCrm.FONOAUDIOLOGIA]: 'FONOAUDIOLOGIA',
  [PfCrm.PROMOTORA]: 'PROMOTORA',
  [PfCrm.ESTAGIARIA_NUTRICAO]: 'ESTAGIARIA NUTRICAO',
  [PfCrm.FISIOTERAPEUTA]: 'FISIOTERAPEUTA',
  [PfCrm.TERAPEUTA]: 'TERAPEUTA',
  [PfCrm.ENFERMEIRO]: 'ENFERMEIRO',
  [PfCrm.BIOMEDICO]: 'BIOMEDICO',
  [PfCrm.NATUROLOGO]: 'NATUROLOGO',
  [PfCrm.MASSOTERAPEUTA]: 'MASSOTERAPEUTA',
  [PfCrm.DERMATICISTA]: 'DERMATICISTA',
  [PfCrm.DERMOCONSULTORA]: 'DERMOCONSULTORA',
  [PfCrm.REGISTRO_MINISTERIO_SAUDE]: 'REGISTRO NO MINISTERIO DA SAUDE',
};

export function normalizarPfCrm(
  value: string | number | null | undefined,
): string | undefined {
  if (value == null) return undefined;
  const t = String(value).trim().toUpperCase();
  return t || undefined;
}

export function rotuloPfCrm(
  value: string | number | null | undefined,
): string {
  const c = normalizarPfCrm(value);
  if (!c) return '';
  return PF_CRM_LABELS[c] ?? `PROFISSAO ${c}`;
}

export function isPfCrmConhecido(
  value: string | number | null | undefined,
): boolean {
  const c = normalizarPfCrm(value);
  return !!c && c in PF_CRM_LABELS;
}
