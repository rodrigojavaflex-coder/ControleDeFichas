import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Data de nascimento do prescritor (FC04000.DTNAS). Opcional.
 */
export class PrescritorDataNascimento1750860000000
  implements MigrationInterface
{
  name = 'PrescritorDataNascimento1750860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE prescritores
      ADD COLUMN IF NOT EXISTS "dataNascimento" date NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE prescritores
      DROP COLUMN IF EXISTS "dataNascimento"
    `);
  }
}
