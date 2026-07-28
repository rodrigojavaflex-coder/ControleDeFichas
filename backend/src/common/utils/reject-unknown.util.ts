/** Normaliza rejeição de Promise para instância Error (ESLint prefer-promise-reject-errors). */
export function rejectReason(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}
