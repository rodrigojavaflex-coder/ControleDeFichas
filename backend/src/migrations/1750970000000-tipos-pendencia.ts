import { MigrationInterface, QueryRunner } from 'typeorm';

/** Cadastro de tipos de pendência e vínculo opcional nas solicitações. */
export class TiposPendencia1750970000000 implements MigrationInterface {
  name = 'TiposPendencia1750970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tipos_pendencia (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        nome varchar(80) NOT NULL,
        descricao text NOT NULL,
        "responsavelId" uuid NOT NULL,
        ativo boolean NOT NULL DEFAULT true,
        "criadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_tipos_pendencia_responsavel
          FOREIGN KEY ("responsavelId") REFERENCES usuarios(id) ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_tipos_pendencia_nome
      ON tipos_pendencia (lower(nome))
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tipos_pendencia_responsavel
      ON tipos_pendencia ("responsavelId")
    `);
    await queryRunner.query(`
      ALTER TABLE solicitacoes
      ADD COLUMN IF NOT EXISTS "tipoPendenciaId" uuid NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_solicitacoes_tipo_pendencia'
        ) THEN
          ALTER TABLE solicitacoes
          ADD CONSTRAINT fk_solicitacoes_tipo_pendencia
          FOREIGN KEY ("tipoPendenciaId") REFERENCES tipos_pendencia(id) ON DELETE RESTRICT;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_solicitacoes_tipo_pendencia
      ON solicitacoes ("tipoPendenciaId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_solicitacoes_tipo_pendencia`);
    await queryRunner.query(`
      ALTER TABLE solicitacoes DROP CONSTRAINT IF EXISTS fk_solicitacoes_tipo_pendencia
    `);
    await queryRunner.query(`
      ALTER TABLE solicitacoes DROP COLUMN IF EXISTS "tipoPendenciaId"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tipos_pendencia_responsavel`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_tipos_pendencia_nome`);
    await queryRunner.query(`DROP TABLE IF EXISTS tipos_pendencia`);
  }
}
