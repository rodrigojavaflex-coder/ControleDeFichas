import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PFCRM (profissão) na identidade do prescritor e nos movimentos/retratos.
 * Unique canônico: numeroCRM + UFCRM + pfcrm.
 */
export class PrescritorPfcrm1750730000000 implements MigrationInterface {
  name = 'PrescritorPfcrm1750730000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE prescritores
      ADD COLUMN IF NOT EXISTS pfcrm varchar(3) NULL
    `);
    await queryRunner.query(`
      UPDATE prescritores SET pfcrm = '1' WHERE pfcrm IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE prescritores
      ALTER COLUMN pfcrm SET DEFAULT '1',
      ALTER COLUMN pfcrm SET NOT NULL
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_prescritores_numero_crm_uf
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_prescritores_crm_uf_pfcrm
      ON prescritores ("numeroCRM", "UFCRM", pfcrm)
      WHERE "numeroCRM" IS NOT NULL AND "UFCRM" IS NOT NULL
    `);

    const satelites: Array<{ table: string; col: string }> = [
      { table: 'orcamentos', col: 'pfcrm' },
      { table: 'caixa_requisicoes_pagas', col: 'pfcrm' },
      { table: 'caixa_requisicao_formula', col: 'pfcrm' },
      { table: 'caixa_itens_erp', col: 'pfcrm' },
      { table: 'painel_medicos_representantes', col: 'pfcrm' },
      { table: 'painel_medicos_representantes_historico', col: 'pfcrm' },
      { table: 'visitacao_fechamento_medico', col: 'pfcrm' },
      { table: 'visitacao_fechamento_carteira', col: 'pfcrm' },
    ];

    for (const { table, col } of satelites) {
      const exists = await queryRunner.query(
        `
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
        `,
        [table],
      );
      if (!exists?.length) continue;
      await queryRunner.query(`
        ALTER TABLE "${table}"
        ADD COLUMN IF NOT EXISTS ${col} varchar(3) NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_prescritores_crm_uf_pfcrm
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_prescritores_numero_crm_uf
      ON prescritores ("numeroCRM", "UFCRM")
      WHERE "numeroCRM" IS NOT NULL AND "UFCRM" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE prescritores DROP COLUMN IF EXISTS pfcrm
    `);

    const satelites = [
      'orcamentos',
      'caixa_requisicoes_pagas',
      'caixa_requisicao_formula',
      'caixa_itens_erp',
      'painel_medicos_representantes',
      'painel_medicos_representantes_historico',
      'visitacao_fechamento_medico',
      'visitacao_fechamento_carteira',
    ];
    for (const table of satelites) {
      await queryRunner.query(`
        ALTER TABLE "${table}" DROP COLUMN IF EXISTS pfcrm
      `);
    }
  }
}
