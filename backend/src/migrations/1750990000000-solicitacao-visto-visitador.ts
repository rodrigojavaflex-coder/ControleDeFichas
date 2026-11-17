import { MigrationInterface, QueryRunner } from 'typeorm';

/** Controle de alterações de pendência ainda não vistas pelo visitador. */
export class SolicitacaoVistoVisitador1750990000000 implements MigrationInterface {
  name = 'SolicitacaoVistoVisitador1750990000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE solicitacoes
      ADD COLUMN IF NOT EXISTS "vistoPeloVisitadorEm" TIMESTAMP NULL
    `);

    // Já conhecidas pelo visitador, exceto resolvidas/reabertas aguardando ação.
    await queryRunner.query(`
      UPDATE solicitacoes
      SET "vistoPeloVisitadorEm" = "criadoEm"
      WHERE "vistoPeloVisitadorEm" IS NULL
        AND status NOT IN ('RESOLVIDA', 'REABERTA')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE solicitacoes
      DROP COLUMN IF EXISTS "vistoPeloVisitadorEm"
    `);
  }
}
