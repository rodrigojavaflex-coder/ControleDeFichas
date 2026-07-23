import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProducaoGestaoCalculo1749400000000 implements MigrationInterface {
  name = 'ProducaoGestaoCalculo1749400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "producao_etapa_remuneracao"
      ADD COLUMN IF NOT EXISTS "tipo_calculo" varchar(16) NOT NULL DEFAULT 'erp'
    `);

    await queryRunner.query(`
      ALTER TABLE "producao_funcionario_etapa"
      ADD COLUMN IF NOT EXISTS "cod_etapa_referencia" varchar(20) NULL
    `);

    await queryRunner.query(`
      UPDATE "producao_etapa_remuneracao"
      SET "tipo_calculo" = 'gestao'
      WHERE "codEtapa" = 'GESTAO'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "producao_funcionario_etapa"
      DROP COLUMN IF EXISTS "cod_etapa_referencia"
    `);

    await queryRunner.query(`
      ALTER TABLE "producao_etapa_remuneracao"
      DROP COLUMN IF EXISTS "tipo_calculo"
    `);
  }
}
