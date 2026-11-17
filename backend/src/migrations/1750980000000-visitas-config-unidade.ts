import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Escopo por unidade em tipos de visita, tipos de pendência e cores dos dias.
 * Clona configurações existentes para cada unidade e remapeia FKs.
 */
export class VisitasConfigUnidade1750980000000 implements MigrationInterface {
  name = 'VisitasConfigUnidade1750980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tipos_visita
      ADD COLUMN IF NOT EXISTS unidade varchar(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE tipos_pendencia
      ADD COLUMN IF NOT EXISTS unidade varchar(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE visita_cores_dias
      ADD COLUMN IF NOT EXISTS unidade varchar(32) NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS uq_tipos_visita_nome`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_tipos_pendencia_nome`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_visita_cores_dias_limite`);

    await queryRunner.query(`
      CREATE TEMP TABLE IF NOT EXISTS tmp_map_tipos_visita (
        old_id uuid NOT NULL,
        unidade varchar(32) NOT NULL,
        new_id uuid NOT NULL
      ) ON COMMIT DROP
    `);
    await queryRunner.query(`TRUNCATE tmp_map_tipos_visita`);
    await queryRunner.query(`
      INSERT INTO tmp_map_tipos_visita (old_id, unidade, new_id)
      SELECT t.id, u.unidade, uuid_generate_v4()
      FROM tipos_visita t
      CROSS JOIN (
        VALUES ('INHUMAS'), ('NERÓPOLIS'), ('UBERABA')
      ) AS u(unidade)
      WHERE t.unidade IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO tipos_visita (id, nome, ativo, unidade, "criadoEm", "atualizadoEm")
      SELECT m.new_id, t.nome, t.ativo, m.unidade, t."criadoEm", CURRENT_TIMESTAMP
      FROM tmp_map_tipos_visita m
      JOIN tipos_visita t ON t.id = m.old_id
    `);
    await queryRunner.query(`
      UPDATE visitas v
      SET "tipoVisitaId" = m.new_id
      FROM tmp_map_tipos_visita m
      WHERE v."tipoVisitaId" = m.old_id
        AND v.unidade = m.unidade
    `);
    await queryRunner.query(`
      UPDATE visitas v
      SET "tipoVisitaId" = m.new_id
      FROM tmp_map_tipos_visita m
      WHERE v."tipoVisitaId" = m.old_id
        AND m.unidade = 'INHUMAS'
        AND NOT EXISTS (
          SELECT 1 FROM tmp_map_tipos_visita x
          WHERE x.old_id = m.old_id AND x.unidade = v.unidade
        )
    `);
    await queryRunner.query(`
      DELETE FROM tipos_visita t
      WHERE EXISTS (
        SELECT 1 FROM tmp_map_tipos_visita m WHERE m.old_id = t.id
      )
    `);

    await queryRunner.query(`
      CREATE TEMP TABLE IF NOT EXISTS tmp_map_tipos_pendencia (
        old_id uuid NOT NULL,
        unidade varchar(32) NOT NULL,
        new_id uuid NOT NULL
      ) ON COMMIT DROP
    `);
    await queryRunner.query(`TRUNCATE tmp_map_tipos_pendencia`);
    await queryRunner.query(`
      INSERT INTO tmp_map_tipos_pendencia (old_id, unidade, new_id)
      SELECT t.id, u.unidade, uuid_generate_v4()
      FROM tipos_pendencia t
      CROSS JOIN (
        VALUES ('INHUMAS'), ('NERÓPOLIS'), ('UBERABA')
      ) AS u(unidade)
      WHERE t.unidade IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO tipos_pendencia (
        id, nome, descricao, "responsavelId", ativo, unidade, "criadoEm", "atualizadoEm"
      )
      SELECT
        m.new_id, t.nome, t.descricao, t."responsavelId", t.ativo, m.unidade,
        t."criadoEm", CURRENT_TIMESTAMP
      FROM tmp_map_tipos_pendencia m
      JOIN tipos_pendencia t ON t.id = m.old_id
    `);
    await queryRunner.query(`
      UPDATE solicitacoes s
      SET "tipoPendenciaId" = m.new_id
      FROM tmp_map_tipos_pendencia m
      WHERE s."tipoPendenciaId" = m.old_id
        AND s.unidade = m.unidade
    `);
    await queryRunner.query(`
      UPDATE solicitacoes s
      SET "tipoPendenciaId" = m.new_id
      FROM tmp_map_tipos_pendencia m
      WHERE s."tipoPendenciaId" = m.old_id
        AND m.unidade = 'INHUMAS'
        AND (
          s.unidade IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM tmp_map_tipos_pendencia x
            WHERE x.old_id = m.old_id AND x.unidade = s.unidade
          )
        )
    `);
    await queryRunner.query(`
      DELETE FROM tipos_pendencia t
      WHERE EXISTS (
        SELECT 1 FROM tmp_map_tipos_pendencia m WHERE m.old_id = t.id
      )
    `);

    await queryRunner.query(`
      CREATE TEMP TABLE IF NOT EXISTS tmp_map_cores (
        old_id uuid NOT NULL,
        unidade varchar(32) NOT NULL,
        new_id uuid NOT NULL
      ) ON COMMIT DROP
    `);
    await queryRunner.query(`TRUNCATE tmp_map_cores`);
    await queryRunner.query(`
      INSERT INTO tmp_map_cores (old_id, unidade, new_id)
      SELECT c.id, u.unidade, uuid_generate_v4()
      FROM visita_cores_dias c
      CROSS JOIN (
        VALUES ('INHUMAS'), ('NERÓPOLIS'), ('UBERABA')
      ) AS u(unidade)
      WHERE c.unidade IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO visita_cores_dias (
        id, dias_acima_de, cor, ativo, unidade, "criadoEm", "atualizadoEm"
      )
      SELECT
        m.new_id, c.dias_acima_de, c.cor, c.ativo, m.unidade,
        c."criadoEm", CURRENT_TIMESTAMP
      FROM tmp_map_cores m
      JOIN visita_cores_dias c ON c.id = m.old_id
    `);
    await queryRunner.query(`
      DELETE FROM visita_cores_dias c
      WHERE EXISTS (
        SELECT 1 FROM tmp_map_cores m WHERE m.old_id = c.id
      )
    `);

    await queryRunner.query(`
      UPDATE tipos_visita SET unidade = 'INHUMAS' WHERE unidade IS NULL
    `);
    await queryRunner.query(`
      UPDATE tipos_pendencia SET unidade = 'INHUMAS' WHERE unidade IS NULL
    `);
    await queryRunner.query(`
      UPDATE visita_cores_dias SET unidade = 'INHUMAS' WHERE unidade IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE tipos_visita ALTER COLUMN unidade SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE tipos_pendencia ALTER COLUMN unidade SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE visita_cores_dias ALTER COLUMN unidade SET NOT NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'ck_tipos_visita_unidade'
        ) THEN
          ALTER TABLE tipos_visita
          ADD CONSTRAINT ck_tipos_visita_unidade
          CHECK (unidade IN ('INHUMAS', 'NERÓPOLIS', 'UBERABA'));
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'ck_tipos_pendencia_unidade'
        ) THEN
          ALTER TABLE tipos_pendencia
          ADD CONSTRAINT ck_tipos_pendencia_unidade
          CHECK (unidade IN ('INHUMAS', 'NERÓPOLIS', 'UBERABA'));
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'ck_visita_cores_dias_unidade'
        ) THEN
          ALTER TABLE visita_cores_dias
          ADD CONSTRAINT ck_visita_cores_dias_unidade
          CHECK (unidade IN ('INHUMAS', 'NERÓPOLIS', 'UBERABA'));
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_tipos_visita_unidade_nome
      ON tipos_visita (unidade, lower(nome))
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_tipos_pendencia_unidade_nome
      ON tipos_pendencia (unidade, lower(nome))
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_visita_cores_dias_unidade_limite
      ON visita_cores_dias (unidade, dias_acima_de)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tipos_visita_unidade
      ON tipos_visita (unidade)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tipos_pendencia_unidade
      ON tipos_pendencia (unidade)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_visita_cores_dias_unidade
      ON visita_cores_dias (unidade)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_visita_cores_dias_unidade`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tipos_pendencia_unidade`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tipos_visita_unidade`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_visita_cores_dias_unidade_limite`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_tipos_pendencia_unidade_nome`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_tipos_visita_unidade_nome`);
    await queryRunner.query(`
      ALTER TABLE visita_cores_dias DROP CONSTRAINT IF EXISTS ck_visita_cores_dias_unidade
    `);
    await queryRunner.query(`
      ALTER TABLE tipos_pendencia DROP CONSTRAINT IF EXISTS ck_tipos_pendencia_unidade
    `);
    await queryRunner.query(`
      ALTER TABLE tipos_visita DROP CONSTRAINT IF EXISTS ck_tipos_visita_unidade
    `);

    // Reverte para um registro por nome/limite (fica a de INHUMAS quando houver).
    await queryRunner.query(`
      DELETE FROM tipos_visita a
      USING tipos_visita b
      WHERE a.unidade <> 'INHUMAS'
        AND lower(a.nome) = lower(b.nome)
        AND b.unidade = 'INHUMAS'
    `);
    await queryRunner.query(`
      DELETE FROM tipos_pendencia a
      USING tipos_pendencia b
      WHERE a.unidade <> 'INHUMAS'
        AND lower(a.nome) = lower(b.nome)
        AND b.unidade = 'INHUMAS'
    `);
    await queryRunner.query(`
      DELETE FROM visita_cores_dias a
      USING visita_cores_dias b
      WHERE a.unidade <> 'INHUMAS'
        AND a.dias_acima_de = b.dias_acima_de
        AND b.unidade = 'INHUMAS'
    `);

    await queryRunner.query(`
      ALTER TABLE tipos_visita DROP COLUMN IF EXISTS unidade
    `);
    await queryRunner.query(`
      ALTER TABLE tipos_pendencia DROP COLUMN IF EXISTS unidade
    `);
    await queryRunner.query(`
      ALTER TABLE visita_cores_dias DROP COLUMN IF EXISTS unidade
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_tipos_visita_nome
      ON tipos_visita (lower(nome))
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_tipos_pendencia_nome
      ON tipos_pendencia (lower(nome))
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_visita_cores_dias_limite
      ON visita_cores_dias (dias_acima_de)
    `);
  }
}
