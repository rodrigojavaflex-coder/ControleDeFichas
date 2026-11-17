import { MigrationInterface, QueryRunner } from 'typeorm';

/** Descrição obrigatória no encerramento da visita de campo. */
export class VisitasDescricao1750900000000 implements MigrationInterface {
  name = 'VisitasDescricao1750900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE visitas
      ADD COLUMN IF NOT EXISTS descricao text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE visitas
      DROP COLUMN IF EXISTS descricao
    `);
  }
}
