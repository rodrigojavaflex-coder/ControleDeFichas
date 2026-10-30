/** Códigos PFCRM (profissão) alinhados ao ERP / backend. */
export const PF_CRM_OPCOES: ReadonlyArray<{ codigo: string; label: string }> = [
  { codigo: '1', label: 'MEDICO' },
  { codigo: '2', label: 'DENTISTA' },
  { codigo: '3', label: 'VETERINARIO' },
  { codigo: '4', label: 'ESTETICISTA' },
  { codigo: '5', label: 'PSICOLOGA' },
  { codigo: '6', label: 'NUTRICIONISTA' },
  { codigo: '7', label: 'FARMACEUTICO' },
  { codigo: '8', label: 'FONOAUDIOLOGIA' },
  { codigo: '9', label: 'PROMOTORA' },
  { codigo: '10', label: 'ESTAGIARIA NUTRICAO' },
  { codigo: 'A', label: 'FISIOTERAPEUTA' },
  { codigo: 'B', label: 'TERAPEUTA' },
  { codigo: 'C', label: 'ENFERMEIRO' },
  { codigo: 'D', label: 'BIOMEDICO' },
  { codigo: 'E', label: 'NATUROLOGO' },
  { codigo: 'F', label: 'MASSOTERAPEUTA' },
  { codigo: 'G', label: 'DERMATICISTA' },
  { codigo: 'H', label: 'DERMOCONSULTORA' },
  { codigo: 'I', label: 'REGISTRO NO MINISTERIO DA SAUDE' },
];

export const PF_CRM_PADRAO = '1';

export function rotuloPfCrm(codigo: string | null | undefined): string {
  if (codigo == null || !String(codigo).trim()) return '—';
  const c = String(codigo).trim().toUpperCase();
  const hit = PF_CRM_OPCOES.find((o) => o.codigo === c);
  return hit ? `${c} — ${hit.label}` : c;
}
