/**
 * Compara versões no formato x.y.z.
 * @returns -1 se a < b, 0 se iguais, 1 se a > b
 */
export function compareSemver(a: string, b: string): number {
  const pa = parseSemverParts(a);
  const pb = parseSemverParts(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) {
      return -1;
    }
    if (pa[i] > pb[i]) {
      return 1;
    }
  }
  return 0;
}

export function isValidSemver(value: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(value.trim());
}

function parseSemverParts(value: string): [number, number, number] {
  const parts = value
    .trim()
    .split('.')
    .map((p) => Number.parseInt(p, 10));
  return [
    Number.isFinite(parts[0]) ? parts[0] : 0,
    Number.isFinite(parts[1]) ? parts[1] : 0,
    Number.isFinite(parts[2]) ? parts[2] : 0,
  ];
}
