import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cadastros `folha_cargo` e `folha_setor`; funcionários passam a referenciá-los por FK.
 * Migra valores distintos das colunas texto `cargo` e `setor` (quando existirem).
 */
export class FolhaCargoSetorFuncionarioRef1740996000000
  implements MigrationInterface
{
  name = 'FolhaCargoSetorFuncionarioRef1740996000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "folha_cargo" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "descricao" varchar(120) NOT NULL,
        "ativo" boolean NOT NULL DEFAULT true,
        "criadoEm" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        "atualizadoEm" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        CONSTRAINT "PK_folha_cargo" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "folha_setor" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "descricao" varchar(120) NOT NULL,
        "ativo" boolean NOT NULL DEFAULT true,
        "criadoEm" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        "atualizadoEm" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        CONSTRAINT "PK_folha_setor" PRIMARY KEY ("id")
      )
    `);

    const hasCargoTxt = await queryRunner.hasColumn('funcionarios', 'cargo');
    const hasSetorTxt = await queryRunner.hasColumn('funcionarios', 'setor');

    await queryRunner.query(`
      ALTER TABLE "funcionarios"
      ADD COLUMN "cargoId" uuid,
      ADD COLUMN "setorId" uuid
    `);

    if (hasCargoTxt) {
      await queryRunner.query(`
        INSERT INTO "folha_cargo" ("id", "descricao", "ativo", "criadoEm", "atualizadoEm")
        SELECT uuid_generate_v4(), sub.normalized, true, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)
        FROM (
          SELECT DISTINCT trim(both from cargo) AS normalized
          FROM funcionarios
          WHERE cargo IS NOT NULL AND trim(both from cargo) <> ''
        ) sub
      `);

      await queryRunner.query(`
        UPDATE "funcionarios" f
        SET "cargoId" = c.id
        FROM "folha_cargo" c
        WHERE f.cargo IS NOT NULL AND trim(both from f.cargo) <> ''
          AND c.descricao = trim(both from f.cargo)
      `);

      await queryRunner.query(`ALTER TABLE "funcionarios" DROP COLUMN "cargo"`);
    }

    if (hasSetorTxt) {
      await queryRunner.query(`
        INSERT INTO "folha_setor" ("id", "descricao", "ativo", "criadoEm", "atualizadoEm")
        SELECT uuid_generate_v4(), sub.normalized, true, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6)
        FROM (
          SELECT DISTINCT trim(both from setor) AS normalized
          FROM funcionarios
          WHERE setor IS NOT NULL AND trim(both from setor) <> ''
        ) sub
      `);

      await queryRunner.query(`
        UPDATE "funcionarios" f
        SET "setorId" = s.id
        FROM "folha_setor" s
        WHERE f.setor IS NOT NULL AND trim(both from f.setor) <> ''
          AND s.descricao = trim(both from f.setor)
      `);

      await queryRunner.query(`ALTER TABLE "funcionarios" DROP COLUMN "setor"`);
    }

    await queryRunner.query(`
      ALTER TABLE "funcionarios"
      ADD CONSTRAINT "FK_funcionarios_cargo"
        FOREIGN KEY ("cargoId") REFERENCES "folha_cargo"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "funcionarios"
      ADD CONSTRAINT "FK_funcionarios_setor"
        FOREIGN KEY ("setorId") REFERENCES "folha_setor"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "funcionarios" DROP CONSTRAINT IF EXISTS "FK_funcionarios_setor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "funcionarios" DROP CONSTRAINT IF EXISTS "FK_funcionarios_cargo"`,
    );

    await queryRunner.query(`
      ALTER TABLE "funcionarios"
      ADD COLUMN "cargo" varchar(150),
      ADD COLUMN "setor" varchar(120)
    `);

    await queryRunner.query(`
      UPDATE "funcionarios" f
      SET "cargo" = c.descricao
      FROM "folha_cargo" c
      WHERE f."cargoId" = c.id
    `);

    await queryRunner.query(`
      UPDATE "funcionarios" f
      SET "setor" = s.descricao
      FROM "folha_setor" s
      WHERE f."setorId" = s.id
    `);

    await queryRunner.query(
      `ALTER TABLE "funcionarios" DROP COLUMN "setorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "funcionarios" DROP COLUMN "cargoId"`,
    );

    await queryRunner.query(`DROP TABLE "folha_setor"`);
    await queryRunner.query(`DROP TABLE "folha_cargo"`);
  }
}
