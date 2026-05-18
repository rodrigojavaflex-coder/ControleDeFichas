import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Momento registrado da abertura vigente da competência (primeiro registro ou após Reabrir).
 */
export class FolhaFechamentoAbertaEm1740992000000 implements MigrationInterface {
  name = 'FolhaFechamentoAbertaEm1740992000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "folha_fechamento"
      ADD "abertaEm" TIMESTAMP NULL
    `);
    await queryRunner.query(`
      UPDATE "folha_fechamento"
      SET "abertaEm" = "criadoEm"
      WHERE "abertaEm" IS NULL AND "criadoEm" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "folha_fechamento"
      DROP COLUMN "abertaEm"
    `);
  }
}
