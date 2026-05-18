import { MigrationInterface, QueryRunner } from 'typeorm';

/** Tipos marcados como folha mensal usam fluxo em massa no lançamento. */
export class FolhaTipoFolhaMensal1740993000000 implements MigrationInterface {
  name = 'FolhaTipoFolhaMensal1740993000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "folha_tipo"
      ADD "folhaMensal" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "folha_tipo"
      DROP COLUMN "folhaMensal"
    `);
  }
}
