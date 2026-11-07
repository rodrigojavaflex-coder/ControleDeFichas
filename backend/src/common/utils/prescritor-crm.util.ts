import { IsNull, Repository } from 'typeorm';
import { Prescritor } from '../../modules/prescritores/entities/prescritor.entity';
import { Unidade } from '../enums/unidade.enum';
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
 * Chave: unidade do movimento + CRM + UF + PFCRM.
 * Enquanto a réplica por unidade não rodou, cai na linha com unidade nula
 * só se não existir a cópia daquela unidade (evita fan-out).
 */
export function sqlOnPrescritores(
  crmExpr: string,
  ufExpr: string,
  alias = 'pr_nome',
  pfcrmExpr: string,
  unidadeExpr: string,
): string {
  const aliasUn = `${alias}_un`;
  return `${alias}."numeroCRM" IS NOT NULL
   AND ${alias}."UFCRM" IS NOT NULL
   AND BTRIM(${alias}."numeroCRM"::text) = BTRIM(CAST(${crmExpr} AS TEXT))
   AND UPPER(BTRIM(${alias}."UFCRM")) = UPPER(BTRIM(${ufExpr}))
   AND UPPER(BTRIM(COALESCE(${alias}.pfcrm, '${PF_CRM_PADRAO_VISITACAO}')))
       = UPPER(BTRIM(COALESCE(CAST(${pfcrmExpr} AS TEXT), '${PF_CRM_PADRAO_VISITACAO}')))
   AND (
     ${alias}.unidade = ${unidadeExpr}
     OR (
       ${alias}.unidade IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM prescritores ${aliasUn}
         WHERE ${aliasUn}."numeroCRM" IS NOT NULL
           AND ${aliasUn}."UFCRM" IS NOT NULL
           AND BTRIM(${aliasUn}."numeroCRM"::text) = BTRIM(CAST(${crmExpr} AS TEXT))
           AND UPPER(BTRIM(${aliasUn}."UFCRM")) = UPPER(BTRIM(${ufExpr}))
           AND UPPER(BTRIM(COALESCE(${aliasUn}.pfcrm, '${PF_CRM_PADRAO_VISITACAO}')))
               = UPPER(BTRIM(COALESCE(CAST(${pfcrmExpr} AS TEXT), '${PF_CRM_PADRAO_VISITACAO}')))
           AND ${aliasUn}.unidade = ${unidadeExpr}
       )
     )
   )`;
}

/** JOIN canônico completo (LEFT JOIN + ON). `unidadeExpr` = unidade do movimento. */
export function sqlLeftJoinPrescritores(
  crmExpr: string,
  ufExpr: string,
  alias = 'pr_nome',
  pfcrmExpr: string,
  unidadeExpr: string,
): string {
  return `LEFT JOIN prescritores ${alias}
    ON ${sqlOnPrescritores(crmExpr, ufExpr, alias, pfcrmExpr, unidadeExpr)}`;
}

export function sqlNomePrescritorJoin(
  alias = 'pr_nome',
  fallbackSql = `''`,
): string {
  return `COALESCE(NULLIF(BTRIM(${alias}.nome), ''), ${fallbackSql})`;
}

/**
 * Garante prescritor da unidade (CRM+UF+PFCRM).
 * Não adota a linha global (unidade nula) nem grava em outra unidade.
 * `atualizarNome` fica ligado só na sync do cadastro FC04000.
 * Nome vindo de fórmula/caixa/painel cria a linha se faltar e não sobrescreve.
 */
export async function garantirPrescritorPorCrmUf(
  repo: Repository<Prescritor>,
  crm: string | number | null | undefined,
  uf: string | null | undefined,
  nome?: string | null,
  pfcrm?: string | number | null,
  unidade?: Unidade | null,
  atualizarNome = false,
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

  const unidadeNorm = unidade ?? null;
  let prescritor = await repo.findOne({
    where: {
      numeroCRM,
      UFCRM,
      pfcrm: pfcrmNorm,
      unidade: unidadeNorm == null ? IsNull() : unidadeNorm,
    },
  });

  if (!prescritor) {
    prescritor = repo.create({
      numeroCRM,
      UFCRM,
      pfcrm: pfcrmNorm,
      unidade: unidadeNorm,
      nome: nomePad || `CRM ${numeroCRM}/${UFCRM}`,
    });
    return repo.save(prescritor);
  }

  if (atualizarNome && nomePad && prescritor.nome !== nomePad) {
    prescritor.nome = nomePad;
    return repo.save(prescritor);
  }

  return prescritor;
}
