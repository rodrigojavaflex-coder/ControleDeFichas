import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsuarioAtalhosHome1743400000000 implements MigrationInterface {
  name = 'UsuarioAtalhosHome1743400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "usuarios"
      ADD COLUMN IF NOT EXISTS "atalhos_home" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "usuarios"
      DROP COLUMN IF EXISTS "atalhos_home"
    `);
  }
}
