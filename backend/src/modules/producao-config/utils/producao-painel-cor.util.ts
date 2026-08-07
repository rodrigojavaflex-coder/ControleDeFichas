import { ProducaoPainelAlertaCor } from '../entities/producao-painel-alerta-retirada.entity';

const LEGACY_HEX: Record<string, string> = {
  [ProducaoPainelAlertaCor.AMARELO]: '#EAB308',
  [ProducaoPainelAlertaCor.LARANJA]: '#F97316',
  [ProducaoPainelAlertaCor.VERMELHO]: '#DC2626',
  [ProducaoPainelAlertaCor.NEUTRO]: ProducaoPainelAlertaCor.NEUTRO,
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function normalizarCorPainelRetirada(cor: string | null | undefined): string {
  const raw = (cor ?? '').trim();
  if (!raw) {
    return ProducaoPainelAlertaCor.NEUTRO;
  }
  const legado = LEGACY_HEX[raw.toUpperCase()];
  if (legado) {
    return legado;
  }
  if (HEX_RE.test(raw)) {
    return raw.toUpperCase();
  }
  return ProducaoPainelAlertaCor.NEUTRO;
}

export function corPainelRetiradaValida(cor: string): boolean {
  const n = normalizarCorPainelRetirada(cor);
  return n === ProducaoPainelAlertaCor.NEUTRO || HEX_RE.test(n);
}
