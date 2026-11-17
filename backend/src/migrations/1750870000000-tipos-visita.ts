import { MigrationInterface, QueryRunner } from 'typeorm';

/** Catálogo de tipos de visita de campo. */
export class TiposVisita1750870000000 implements MigrationInterface {
  name = 'TiposVisita1750870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tipos_visita (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        nome varchar(80) NOT NULL,
        ativo boolean NOT NULL DEFAULT true,
        "criadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_tipos_visita_nome
      ON tipos_visita (lower(nome))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_tipos_visita_nome
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS tipos_visita
    `);
  }
}
