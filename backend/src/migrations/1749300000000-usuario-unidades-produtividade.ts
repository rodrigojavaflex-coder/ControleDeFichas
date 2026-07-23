import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsuarioUnidadesProdutividade1749300000000
  implements MigrationInterface
{
  name = 'UsuarioUnidadesProdutividade1749300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "usuarios"
      ADD COLUMN IF NOT EXISTS "unidades_produtividade" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "usuarios"
      DROP COLUMN IF EXISTS "unidades_produtividade"
    `);
  }
}
