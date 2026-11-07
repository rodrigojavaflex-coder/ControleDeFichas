import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Prescritor passa a poder existir uma vez por unidade.
 * A réplica dos dados (cópias + nomes) roda em
 * POST /sincronizacao/replicar-prescritores-unidade — não aqui.
 */
export class PrescritorUnidade1750740000000 implements MigrationInterface {
  name = 'PrescritorUnidade1750740000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE prescritores
      ADD COLUMN IF NOT EXISTS unidade varchar(32) NULL
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_prescritores_crm_uf_pfcrm
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_prescritores_unidade_crm_uf_pfcrm
      ON prescritores (unidade, "numeroCRM", "UFCRM", pfcrm)
      WHERE unidade IS NOT NULL
        AND "numeroCRM" IS NOT NULL
        AND "UFCRM" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_prescritores_crm_uf_pfcrm_sem_unidade
      ON prescritores ("numeroCRM", "UFCRM", pfcrm)
      WHERE unidade IS NULL
        AND "numeroCRM" IS NOT NULL
        AND "UFCRM" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_prescritores_unidade_crm_uf_pfcrm
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_prescritores_crm_uf_pfcrm_sem_unidade
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_prescritores_crm_uf_pfcrm
      ON prescritores ("numeroCRM", "UFCRM", pfcrm)
      WHERE "numeroCRM" IS NOT NULL AND "UFCRM" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE prescritores DROP COLUMN IF EXISTS unidade
    `);
  }
}
