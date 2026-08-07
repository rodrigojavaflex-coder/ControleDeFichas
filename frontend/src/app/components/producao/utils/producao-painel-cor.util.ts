import {
  ProducaoPainelAlertaConfig,
  ProducaoPainelAlertaFormRow,
} from '../../../models/producao-painel.model';

const LEGACY_HEX: Record<string, string> = {
  AMARELO: '#EAB308',
  LARANJA: '#F97316',
  VERMELHO: '#DC2626',
  NEUTRO: 'NEUTRO',
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function normalizarCorPainel(cor: string | null | undefined): string {
  const raw = (cor ?? '').trim();
  if (!raw) {
    return 'NEUTRO';
  }
  const legado = LEGACY_HEX[raw.toUpperCase()];
  if (legado) {
    return legado;
  }
  if (HEX_RE.test(raw)) {
    return raw.toUpperCase();
  }
  return 'NEUTRO';
}

export function corPainelParaInputColor(cor: string): string {
  const n = normalizarCorPainel(cor);
  if (n === 'NEUTRO' || !HEX_RE.test(n)) {
    return '#64748B';
  }
  return n;
}

export function estiloFundoPainel(cor: string): Record<string, string> | null {
  const n = normalizarCorPainel(cor);
  if (n === 'NEUTRO') {
    return null;
  }
  return {
    background: `color-mix(in srgb, ${n} 18%, var(--cor-superficie, #fff))`,
  };
}

export function minutosParaHorasPainel(minutos: number | null | undefined): number | null {
  if (minutos == null) {
    return null;
  }
  return Math.round((minutos / 60) * 100) / 100;
}

export function horasParaMinutosPainel(horas: number | null | undefined): number | null {
  if (horas == null || Number.isNaN(horas)) {
    return null;
  }
  const min = Math.round(horas * 60);
  return min < 1 ? 1 : min;
}

export function alertaConfigParaForm(a: ProducaoPainelAlertaConfig): ProducaoPainelAlertaFormRow {
  return {
    ...a,
    cor: normalizarCorPainel(a.cor),
    horasAntes:
      a.tipo === 'ANTES' ? minutosParaHorasPainel(a.minutosAntes) : null,
  };
}

export function alertaFormParaConfig(a: ProducaoPainelAlertaFormRow): ProducaoPainelAlertaConfig {
  return {
    id: a.id,
    ordem: a.ordem,
    tipo: a.tipo,
    minutosAntes:
      a.tipo === 'ANTES' ? horasParaMinutosPainel(a.horasAntes) : null,
    cor: normalizarCorPainel(a.cor),
    rotulo: a.rotulo,
  };
}
