import { Repository } from 'typeorm';
import { Prescritor } from '../../modules/prescritores/entities/prescritor.entity';
import { padronizarNomeDeSistemaLegado } from './encoding-legado.util';
import {
  PF_CRM_PADRAO_VISITACAO,
  normalizarPfCrm,
} from '../enums/pf-crm.enum';

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
 * Condição ON do JOIN canônico: satélite → prescritores.
 * Sempre inclui PFCRM (COALESCE → padrão MEDICO) para evitar fan-out
 * quando o mesmo CRM+UF tem várias profissões.
 */
export function sqlOnPrescritores(
  crmExpr: string,
  ufExpr: string,
  alias = 'pr_nome',
  pfcrmExpr: string,
): string {
  return `${alias}."numeroCRM" IS NOT NULL
   AND ${alias}."UFCRM" IS NOT NULL
   AND BTRIM(${alias}."numeroCRM"::text) = BTRIM(CAST(${crmExpr} AS TEXT))
   AND UPPER(BTRIM(${alias}."UFCRM")) = UPPER(BTRIM(${ufExpr}))
   AND UPPER(BTRIM(COALESCE(${alias}.pfcrm, '${PF_CRM_PADRAO_VISITACAO}')))
       = UPPER(BTRIM(COALESCE(CAST(${pfcrmExpr} AS TEXT), '${PF_CRM_PADRAO_VISITACAO}')))`;
}

/** JOIN canônico completo (LEFT JOIN + ON). */
export function sqlLeftJoinPrescritores(
  crmExpr: string,
  ufExpr: string,
  alias = 'pr_nome',
  pfcrmExpr: string,
): string {
  return `LEFT JOIN prescritores ${alias}
    ON ${sqlOnPrescritores(crmExpr, ufExpr, alias, pfcrmExpr)}`;
}

export function sqlNomePrescritorJoin(
  alias = 'pr_nome',
  fallbackSql = `''`,
): string {
  return `COALESCE(NULLIF(BTRIM(${alias}.nome), ''), ${fallbackSql})`;
}

/**
 * Garante prescritor por CRM+UF+PFCRM; atualiza nome se vier do ERP.
 */
export async function garantirPrescritorPorCrmUf(
  repo: Repository<Prescritor>,
  crm: string | number | null | undefined,
  uf: string | null | undefined,
  nome?: string | null,
  pfcrm?: string | number | null,
): Promise<Prescritor | null> {
  const numeroCRM = parseCrmNumero(crm);
  const UFCRM = normalizarUfCrm(uf);
  const pfcrmNorm = normalizarPfCrm(pfcrm) ?? PF_CRM_PADRAO_VISITACAO;
  if (numeroCRM == null || !UFCRM) {
    return null;
  }

  const nomePad = nome?.trim()
    ? padronizarNomeDeSistemaLegado(nome)
    : '';

  let prescritor = await repo.findOne({
    where: { numeroCRM, UFCRM, pfcrm: pfcrmNorm },
  });

  if (!prescritor) {
    prescritor = repo.create({
      numeroCRM,
      UFCRM,
      pfcrm: pfcrmNorm,
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
