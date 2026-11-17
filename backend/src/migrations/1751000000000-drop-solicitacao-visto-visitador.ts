import { MigrationInterface, QueryRunner } from 'typeorm';

/** O aviso do app conta pendências resolvidas; não usa mais visto do visitador. */
export class DropSolicitacaoVistoVisitador1751000000000 implements MigrationInterface {
  name = 'DropSolicitacaoVistoVisitador1751000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE solicitacoes
      DROP COLUMN IF EXISTS "vistoPeloVisitadorEm"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE solicitacoes
      ADD COLUMN IF NOT EXISTS "vistoPeloVisitadorEm" TIMESTAMP NULL
    `);
  }
}
