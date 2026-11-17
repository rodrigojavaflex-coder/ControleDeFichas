import { MigrationInterface, QueryRunner } from 'typeorm';

/** Faixas de cor do rótulo de dias da visita no app. */
export class VisitaCoresDias1750940000000 implements MigrationInterface {
  name = 'VisitaCoresDias1750940000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS visita_cores_dias (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        dias_acima_de integer NOT NULL,
        cor varchar(7) NOT NULL,
        ativo boolean NOT NULL DEFAULT true,
        "criadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT ck_visita_cores_dias_limite CHECK (dias_acima_de >= 0),
        CONSTRAINT ck_visita_cores_dias_cor CHECK (cor ~ '^#[0-9A-Fa-f]{6}$')
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_visita_cores_dias_limite
      ON visita_cores_dias (dias_acima_de)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_visita_cores_dias_limite
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS visita_cores_dias
    `);
  }
}
