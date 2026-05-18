import { MigrationInterface, QueryRunner } from 'typeorm';

export class FolhaItemQuantidade1740994000000 implements MigrationInterface {
  name = 'FolhaItemQuantidade1740994000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "folha_item"
      ADD COLUMN IF NOT EXISTS "quantidade" DECIMAL(14,4) NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      UPDATE "folha_item" SET "quantidade" = 1 WHERE "quantidade" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "folha_item" DROP COLUMN IF EXISTS "quantidade"`);
  }
}
