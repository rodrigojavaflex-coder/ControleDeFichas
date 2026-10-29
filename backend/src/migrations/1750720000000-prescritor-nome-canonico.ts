import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nome canônico do médico em `prescritores` (CRM+UF).
 * - Backfill + dedupe + UNIQUE parcial
 * - Remove nome_medico das satélites de sync (painel ativo, orçamentos, caixa)
 * - Mantém nome no retrato de visitação e no histórico do painel
 */
export class PrescritorNomeCanonico1750720000000
  implements MigrationInterface
{
  name = 'PrescritorNomeCanonico1750720000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const antes = await this.contarPrescritoresComCrmUf(queryRunner);
    console.log(
      `[175072] Início nome canônico — prescritores com CRM+UF: ${antes}`,
    );

    await this.backfillPrescritores(queryRunner);
    const aposBackfill = await this.contarPrescritoresComCrmUf(queryRunner);
    console.log(
      `[175072] Após backfill — prescritores com CRM+UF: ${aposBackfill} (+${aposBackfill - antes})`,
    );

    await this.dedupePrescritores(queryRunner);
    const aposDedupe = await this.contarPrescritoresComCrmUf(queryRunner);
    console.log(
      `[175072] Após dedupe — prescritores com CRM+UF: ${aposDedupe}`,
    );

    await this.ensureUniqueCrmUf(queryRunner);
    console.log('[175072] Índice uq_prescritores_numero_crm_uf OK');

    await this.dropSatelliteNomeColumns(queryRunner);
    console.log(
      '[175072] Colunas nome satélite removidas (retrato/histórico preservados)',
    );
  }

  private async contarPrescritoresComCrmUf(
    queryRunner: QueryRunner,
  ): Promise<number> {
    const rows = await queryRunner.query(`
      SELECT COUNT(*)::int AS qtd
      FROM prescritores
      WHERE "numeroCRM" IS NOT NULL
        AND "UFCRM" IS NOT NULL
        AND BTRIM("UFCRM") <> ''
    `);
    return Number(rows?.[0]?.qtd ?? 0);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.restoreSatelliteNomeColumns(queryRunner);
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_prescritores_numero_crm_uf
    `);
  }

  private async backfillPrescritores(
    queryRunner: QueryRunner,
  ): Promise<void> {
    // Preferir nome sem marcadores de corrupção; senão o mais longo
    await queryRunner.query(`
      WITH fontes AS (
        SELECT
          NULLIF(BTRIM("crmMedico"), '') AS crm_txt,
          UPPER(NULLIF(BTRIM("ufCrmMedico"), '')) AS uf,
          NULLIF(BTRIM("nomeMedico"), '') AS nome,
          1 AS prioridade
        FROM painel_medicos_representantes
        WHERE "crmMedico" IS NOT NULL
          AND BTRIM("crmMedico") <> ''
          AND "ufCrmMedico" IS NOT NULL
          AND BTRIM("ufCrmMedico") <> ''
          AND "nomeMedico" IS NOT NULL
          AND BTRIM("nomeMedico") <> ''

        UNION ALL

        SELECT
          NULLIF(BTRIM("crmMedico"), ''),
          UPPER(NULLIF(BTRIM("ufcrmMedico"), '')),
          NULLIF(BTRIM("nomeMedico"), ''),
          2
        FROM orcamentos
        WHERE "crmMedico" IS NOT NULL
          AND BTRIM("crmMedico") <> ''
          AND "ufcrmMedico" IS NOT NULL
          AND BTRIM("ufcrmMedico") <> ''
          AND "nomeMedico" IS NOT NULL
          AND BTRIM("nomeMedico") <> ''

        UNION ALL

        SELECT
          NULLIF(BTRIM(crm_medico), ''),
          UPPER(NULLIF(BTRIM(uf_crm_medico), '')),
          NULLIF(BTRIM(nome_medico), ''),
          3
        FROM caixa_requisicoes_pagas
        WHERE crm_medico IS NOT NULL
          AND BTRIM(crm_medico) <> ''
          AND uf_crm_medico IS NOT NULL
          AND BTRIM(uf_crm_medico) <> ''
          AND nome_medico IS NOT NULL
          AND BTRIM(nome_medico) <> ''

        UNION ALL

        SELECT
          NULLIF(BTRIM(crm_medico), ''),
          UPPER(NULLIF(BTRIM(uf_crm_medico), '')),
          NULLIF(BTRIM(nome_medico), ''),
          4
        FROM caixa_requisicao_formula
        WHERE crm_medico IS NOT NULL
          AND BTRIM(crm_medico) <> ''
          AND uf_crm_medico IS NOT NULL
          AND BTRIM(uf_crm_medico) <> ''
          AND nome_medico IS NOT NULL
          AND BTRIM(nome_medico) <> ''
      ),
      validas AS (
        SELECT
          crm_txt::integer AS numero_crm,
          uf,
          nome,
          prioridade
        FROM fontes
        WHERE crm_txt ~ '^[0-9]+$'
          AND uf ~ '^[A-Z]{2}$'
          AND nome IS NOT NULL
      ),
      ranked AS (
        SELECT DISTINCT ON (numero_crm, uf)
          numero_crm,
          uf,
          nome
        FROM validas
        ORDER BY
          numero_crm,
          uf,
          CASE
            WHEN nome LIKE '%' || CHR(65533) || '%'
              OR nome ~ '[ýÿÝ]|Ç[BCDFGHJKLMNPQRSTVXZ]|JÉ[A-ZÀ-Ú]' THEN 1
            ELSE 0
          END ASC,
          prioridade ASC,
          LENGTH(nome) DESC
      )
      INSERT INTO prescritores (id, nome, "numeroCRM", "UFCRM", "criadoEm", "atualizadoEm")
      SELECT
        uuid_generate_v4(),
        r.nome,
        r.numero_crm,
        r.uf,
        NOW(),
        NOW()
      FROM ranked r
      WHERE NOT EXISTS (
        SELECT 1
        FROM prescritores p
        WHERE p."numeroCRM" = r.numero_crm
          AND UPPER(BTRIM(p."UFCRM")) = r.uf
      )
    `);

    // Atualiza nome existente se o canônico atual parece corrompido e a fonte não
    await queryRunner.query(`
      WITH fontes AS (
        SELECT
          NULLIF(BTRIM("crmMedico"), '') AS crm_txt,
          UPPER(NULLIF(BTRIM("ufCrmMedico"), '')) AS uf,
          NULLIF(BTRIM("nomeMedico"), '') AS nome,
          1 AS prioridade
        FROM painel_medicos_representantes
        WHERE "nomeMedico" IS NOT NULL AND BTRIM("nomeMedico") <> ''

        UNION ALL
        SELECT
          NULLIF(BTRIM("crmMedico"), ''),
          UPPER(NULLIF(BTRIM("ufcrmMedico"), '')),
          NULLIF(BTRIM("nomeMedico"), ''),
          2
        FROM orcamentos
        WHERE "nomeMedico" IS NOT NULL AND BTRIM("nomeMedico") <> ''

        UNION ALL
        SELECT
          NULLIF(BTRIM(crm_medico), ''),
          UPPER(NULLIF(BTRIM(uf_crm_medico), '')),
          NULLIF(BTRIM(nome_medico), ''),
          3
        FROM caixa_requisicoes_pagas
        WHERE nome_medico IS NOT NULL AND BTRIM(nome_medico) <> ''

        UNION ALL
        SELECT
          NULLIF(BTRIM(crm_medico), ''),
          UPPER(NULLIF(BTRIM(uf_crm_medico), '')),
          NULLIF(BTRIM(nome_medico), ''),
          4
        FROM caixa_requisicao_formula
        WHERE nome_medico IS NOT NULL AND BTRIM(nome_medico) <> ''
      ),
      validas AS (
        SELECT crm_txt::integer AS numero_crm, uf, nome, prioridade
        FROM fontes
        WHERE crm_txt ~ '^[0-9]+$'
          AND uf ~ '^[A-Z]{2}$'
          AND nome IS NOT NULL
      ),
      ranked AS (
        SELECT DISTINCT ON (numero_crm, uf)
          numero_crm, uf, nome
        FROM validas
        ORDER BY
          numero_crm, uf,
          CASE
            WHEN nome LIKE '%' || CHR(65533) || '%'
              OR nome ~ '[ýÿÝ]|Ç[BCDFGHJKLMNPQRSTVXZ]|JÉ[A-ZÀ-Ú]' THEN 1
            ELSE 0
          END ASC,
          prioridade ASC,
          LENGTH(nome) DESC
      )
      UPDATE prescritores p
      SET
        nome = r.nome,
        "atualizadoEm" = NOW()
      FROM ranked r
      WHERE p."numeroCRM" = r.numero_crm
        AND UPPER(BTRIM(p."UFCRM")) = r.uf
        AND p.nome IS DISTINCT FROM r.nome
        AND (
          p.nome LIKE '%' || CHR(65533) || '%'
          OR p.nome ~ '[ýÿÝ]|Ç[BCDFGHJKLMNPQRSTVXZ]|JÉ[A-ZÀ-Ú]'
          OR BTRIM(COALESCE(p.nome, '')) = ''
        )
        AND r.nome NOT LIKE '%' || CHR(65533) || '%'
        AND r.nome !~ '[ýÿÝ]|Ç[BCDFGHJKLMNPQRSTVXZ]|JÉ[A-ZÀ-Ú]'
    `);
  }

  private async dedupePrescritores(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      UPDATE prescritores
      SET "UFCRM" = UPPER(BTRIM("UFCRM"))
      WHERE "UFCRM" IS NOT NULL
        AND "UFCRM" <> UPPER(BTRIM("UFCRM"))
    `);

    // Mantém o melhor nome / mais antigo; remapeia vendas.prescritorId
    await queryRunner.query(`
      CREATE TEMP TABLE tmp_prescritor_keep ON COMMIT DROP AS
      WITH ranked AS (
        SELECT
          id,
          "numeroCRM",
          UPPER(BTRIM("UFCRM")) AS uf,
          ROW_NUMBER() OVER (
            PARTITION BY "numeroCRM", UPPER(BTRIM("UFCRM"))
            ORDER BY
              CASE
                WHEN nome LIKE '%' || CHR(65533) || '%'
                  OR nome ~ '[ýÿÝ]|Ç[BCDFGHJKLMNPQRSTVXZ]|JÉ[A-ZÀ-Ú]' THEN 1
                ELSE 0
              END ASC,
              LENGTH(COALESCE(nome, '')) DESC,
              "criadoEm" ASC NULLS LAST,
              id ASC
          ) AS rn
        FROM prescritores
        WHERE "numeroCRM" IS NOT NULL
          AND "UFCRM" IS NOT NULL
          AND BTRIM("UFCRM") <> ''
      )
      SELECT
        r.id AS keep_id,
        d.id AS drop_id
      FROM ranked r
      JOIN ranked d
        ON d."numeroCRM" = r."numeroCRM"
       AND d.uf = r.uf
       AND d.rn > 1
      WHERE r.rn = 1
    `);

    const hasVendas = await queryRunner.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'vendas'
      LIMIT 1
    `);
    if (hasVendas?.length) {
      await queryRunner.query(`
        UPDATE vendas v
        SET "prescritorId" = t.keep_id
        FROM tmp_prescritor_keep t
        WHERE v."prescritorId" = t.drop_id
      `);
    }

    await queryRunner.query(`
      DELETE FROM prescritores p
      USING tmp_prescritor_keep t
      WHERE p.id = t.drop_id
    `);
  }

  private async ensureUniqueCrmUf(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const idx = await queryRunner.query(`
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'uq_prescritores_numero_crm_uf'
      LIMIT 1
    `);
    if (!idx?.length) {
      await queryRunner.query(`
        CREATE UNIQUE INDEX uq_prescritores_numero_crm_uf
        ON prescritores ("numeroCRM", "UFCRM")
        WHERE "numeroCRM" IS NOT NULL
          AND "UFCRM" IS NOT NULL
      `);
    }
  }

  private async dropSatelliteNomeColumns(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const drops: Array<{ table: string; column: string }> = [
      { table: 'painel_medicos_representantes', column: 'nomeMedico' },
      { table: 'orcamentos', column: 'nomeMedico' },
      { table: 'caixa_requisicoes_pagas', column: 'nome_medico' },
      { table: 'caixa_requisicao_formula', column: 'nome_medico' },
    ];

    for (const { table, column } of drops) {
      const has = await queryRunner.query(
        `
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
        LIMIT 1
      `,
        [table, column],
      );
      if (has?.length) {
        await queryRunner.query(
          `ALTER TABLE "${table}" DROP COLUMN "${column}"`,
        );
      }
    }
  }

  private async restoreSatelliteNomeColumns(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const restores: Array<{
      table: string;
      column: string;
      ddl: string;
    }> = [
      {
        table: 'painel_medicos_representantes',
        column: 'nomeMedico',
        ddl: `ALTER TABLE painel_medicos_representantes ADD COLUMN "nomeMedico" varchar(500) NOT NULL DEFAULT ''`,
      },
      {
        table: 'orcamentos',
        column: 'nomeMedico',
        ddl: `ALTER TABLE orcamentos ADD COLUMN "nomeMedico" varchar(500) NULL`,
      },
      {
        table: 'caixa_requisicoes_pagas',
        column: 'nome_medico',
        ddl: `ALTER TABLE caixa_requisicoes_pagas ADD COLUMN nome_medico varchar(500) NULL`,
      },
      {
        table: 'caixa_requisicao_formula',
        column: 'nome_medico',
        ddl: `ALTER TABLE caixa_requisicao_formula ADD COLUMN nome_medico varchar(500) NULL`,
      },
    ];

    for (const { table, column, ddl } of restores) {
      const has = await queryRunner.query(
        `
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
        LIMIT 1
      `,
        [table, column],
      );
      if (!has?.length) {
        await queryRunner.query(ddl);
        if (table === 'painel_medicos_representantes') {
          await queryRunner.query(`
            ALTER TABLE painel_medicos_representantes
            ALTER COLUMN "nomeMedico" DROP DEFAULT
          `);
        }
      }
    }
  }
}
