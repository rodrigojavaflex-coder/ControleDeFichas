import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserMultiPerfis1743300000000 implements MigrationInterface {
  name = 'UserMultiPerfis1743300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "usuarios_perfis" (
        "usuario_id" uuid NOT NULL,
        "perfil_id" uuid NOT NULL,
        CONSTRAINT "PK_usuarios_perfis" PRIMARY KEY ("usuario_id", "perfil_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_usuarios_perfis_usuario" ON "usuarios_perfis" ("usuario_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_usuarios_perfis_perfil" ON "usuarios_perfis" ("perfil_id")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_usuarios_perfis_usuario'
        ) THEN
          ALTER TABLE "usuarios_perfis"
          ADD CONSTRAINT "FK_usuarios_perfis_usuario"
          FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_usuarios_perfis_perfil'
        ) THEN
          ALTER TABLE "usuarios_perfis"
          ADD CONSTRAINT "FK_usuarios_perfis_perfil"
          FOREIGN KEY ("perfil_id") REFERENCES "perfil"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      INSERT INTO "usuarios_perfis" ("usuario_id", "perfil_id")
      SELECT DISTINCT u."id", u."perfilId"
      FROM "usuarios" u
      WHERE u."perfilId" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        fk_name text;
      BEGIN
        SELECT con.conname
          INTO fk_name
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_attribute att ON att.attrelid = rel.oid
                             AND att.attnum = ANY(con.conkey)
        WHERE rel.relname = 'usuarios'
          AND att.attname = 'perfilId'
          AND con.contype = 'f'
        LIMIT 1;

        IF fk_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE "usuarios" DROP CONSTRAINT %I', fk_name);
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "usuarios" DROP COLUMN IF EXISTS "perfilId"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "usuarios"
      ADD COLUMN IF NOT EXISTS "perfilId" uuid
    `);

    await queryRunner.query(`
      UPDATE "usuarios" u
      SET "perfilId" = source."perfil_id"
      FROM (
        SELECT up."usuario_id", MIN(up."perfil_id") AS "perfil_id"
        FROM "usuarios_perfis" up
        GROUP BY up."usuario_id"
      ) source
      WHERE source."usuario_id" = u."id"
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_usuarios_perfil_legacy'
        ) THEN
          ALTER TABLE "usuarios"
          ADD CONSTRAINT "FK_usuarios_perfil_legacy"
          FOREIGN KEY ("perfilId") REFERENCES "perfil"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "usuarios_perfis"`);
  }
}
