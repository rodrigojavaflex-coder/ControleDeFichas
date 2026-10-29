import { Repository } from 'typeorm';
import { Prescritor } from '../../modules/prescritores/entities/prescritor.entity';
import { padronizarNomeDeSistemaLegado } from './encoding-legado.util';

/** Normaliza CRM para comparação (só dígitos). */
export function normalizarCrmTexto(
  crm: string | number | null | undefined,
): string {
  if (crm == null) return '';
  return String(crm).trim().replace(/\s+/g, '');
}

export function parseCrmNumero(
  crm: string | number | null | undefined,
): number | null {
  const t = normalizarCrmTexto(crm);
  if (!t || !/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function normalizarUfCrm(
  uf: string | null | undefined,
): string | undefined {
  const t = uf?.trim().toUpperCase();
  return t || undefined;
}

/**
 * Condição ON do JOIN canônico: satélite (CRM texto + UF) → prescritores.
 * `crmExpr` / `ufExpr` = expressões SQL já no escopo (ex.: BTRIM(f.crm_medico)).
 */
export function sqlOnPrescritores(
  crmExpr: string,
  ufExpr: string,
  alias = 'pr_nome',
): string {
  return `${alias}."numeroCRM" IS NOT NULL
   AND ${alias}."UFCRM" IS NOT NULL
   AND BTRIM(${alias}."numeroCRM"::text) = BTRIM(CAST(${crmExpr} AS TEXT))
   AND UPPER(BTRIM(${alias}."UFCRM")) = UPPER(BTRIM(${ufExpr}))`;
}

/** JOIN canônico completo (LEFT JOIN + ON). */
export function sqlLeftJoinPrescritores(
  crmExpr: string,
  ufExpr: string,
  alias = 'pr_nome',
): string {
  return `LEFT JOIN prescritores ${alias}
    ON ${sqlOnPrescritores(crmExpr, ufExpr, alias)}`;
}

export function sqlNomePrescritorJoin(
  alias = 'pr_nome',
  fallbackSql = `''`,
): string {
  return `COALESCE(NULLIF(BTRIM(${alias}.nome), ''), ${fallbackSql})`;
}

/**
 * Garante prescritor por CRM+UF; atualiza nome se vier do ERP.
 */
export async function garantirPrescritorPorCrmUf(
  repo: Repository<Prescritor>,
  crm: string | number | null | undefined,
  uf: string | null | undefined,
  nome?: string | null,
): Promise<Prescritor | null> {
  const numeroCRM = parseCrmNumero(crm);
  const UFCRM = normalizarUfCrm(uf);
  if (numeroCRM == null || !UFCRM) {
    return null;
  }

  const nomePad = nome?.trim()
    ? padronizarNomeDeSistemaLegado(nome)
    : '';

  let prescritor = await repo.findOne({
    where: { numeroCRM, UFCRM },
  });

  if (!prescritor) {
    prescritor = repo.create({
      numeroCRM,
      UFCRM,
      nome: nomePad || `CRM ${numeroCRM}/${UFCRM}`,
    });
    return repo.save(prescritor);
  }

  if (nomePad && prescritor.nome !== nomePad) {
    prescritor.nome = nomePad;
    return repo.save(prescritor);
  }

  return prescritor;
}
