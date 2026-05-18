import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * - Coluna `unidade` em `funcionarios` (backfill determinístico a partir de `funcionario_unidade`: MIN textual).
 * - Funcionários sem vínculos: `'INHUMAS'`.
 * - `folha_capa` referencia diretamente `funcionarios`; consolida capas duplicadas (mesmo funcionário/competência/tipo).
 * - Remove `funcionario_unidade`.
 */
export class FolhaFuncionarioUnidadeNoCadastro1740950000000
  implements MigrationInterface
{
  name = 'FolhaFuncionarioUnidadeNoCadastro1740950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'funcionarios',
      new TableColumn({
        name: 'unidade',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );

    await queryRunner.query(`
      UPDATE "funcionarios" f
      SET "unidade" = agg.u
      FROM (
        SELECT "funcionarioId", MIN("unidade"::text)::varchar(32) AS u
        FROM "funcionario_unidade"
        GROUP BY "funcionarioId"
      ) agg
      WHERE agg."funcionarioId" = f.id
    `);

    await queryRunner.query(`
      UPDATE "funcionarios" SET "unidade" = 'INHUMAS' WHERE "unidade" IS NULL
    `);

    await queryRunner.changeColumn(
      'funcionarios',
      'unidade',
      new TableColumn({
        name: 'unidade',
        type: 'varchar',
        length: '32',
        isNullable: false,
      }),
    );

    await queryRunner.addColumn(
      'folha_capa',
      new TableColumn({
        name: 'funcionarioId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.query(`
      UPDATE "folha_capa" c
      SET "funcionarioId" = fu."funcionarioId"
      FROM "funcionario_unidade" fu
      WHERE fu.id = c."funcionarioUnidadeId"
    `);

    await queryRunner.query(`
      WITH capa_keepers AS (
        SELECT DISTINCT ON ("funcionarioId", ano, mes, "folhaTipoId")
          id AS keeper_id,
          "funcionarioId",
          ano,
          mes,
          "folhaTipoId"
        FROM "folha_capa"
        WHERE "funcionarioId" IS NOT NULL
        ORDER BY "funcionarioId", ano, mes, "folhaTipoId", id
      ),
      capa_map AS (
        SELECT c.id AS old_id, k.keeper_id
        FROM "folha_capa" c
        INNER JOIN capa_keepers k
          ON c."funcionarioId" = k."funcionarioId"
          AND c.ano = k.ano
          AND c.mes = k.mes
          AND c."folhaTipoId" = k."folhaTipoId"
      )
      UPDATE "folha_item" fi
      SET "folhaCapaId" = m.keeper_id
      FROM capa_map m
      WHERE fi."folhaCapaId" = m.old_id AND m.old_id <> m.keeper_id
    `);

    await queryRunner.query(`
      DELETE FROM "folha_capa" c
      USING (
        SELECT id,
          FIRST_VALUE(id) OVER (
            PARTITION BY "funcionarioId", ano, mes, "folhaTipoId"
            ORDER BY id
          ) AS keeper
        FROM "folha_capa"
        WHERE "funcionarioId" IS NOT NULL
      ) x
      WHERE c.id = x.id AND c.id <> x.keeper AND c."funcionarioId" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "folha_capa" DROP CONSTRAINT IF EXISTS "UQ_folha_capa_competencia"
    `);

    const fuFkRows: Array<{ constraint_name: string }> = await queryRunner.query(
      `
      SELECT tc.constraint_name AS constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'folha_capa'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'funcionarioUnidadeId'
    `,
    );
    for (const r of fuFkRows) {
      await queryRunner.query(
        `ALTER TABLE "folha_capa" DROP CONSTRAINT IF EXISTS "${r.constraint_name}"`,
      );
    }

    await queryRunner.dropIndex('folha_capa', 'idx_folha_capa_unidade_lookup');

    await queryRunner.dropColumn('folha_capa', 'funcionarioUnidadeId');

    await queryRunner.changeColumn(
      'folha_capa',
      'funcionarioId',
      new TableColumn({
        name: 'funcionarioId',
        type: 'uuid',
        isNullable: false,
      }),
    );

    await queryRunner.createForeignKey(
      'folha_capa',
      new TableForeignKey({
        columnNames: ['funcionarioId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'funcionarios',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.query(`
      ALTER TABLE "folha_capa"
      ADD CONSTRAINT "UQ_folha_capa_competencia"
      UNIQUE ("funcionarioId", ano, mes, "folhaTipoId")
    `);

    await queryRunner.createIndex(
      'folha_capa',
      new TableIndex({
        name: 'idx_folha_capa_funcionario_competencia',
        columnNames: ['funcionarioId', 'ano', 'mes', 'folhaTipoId'],
      }),
    );

    await queryRunner.dropTable('funcionario_unidade', true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'funcionario_unidade',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'funcionarioId', type: 'uuid', isNullable: false },
          { name: 'unidade', type: 'varchar', length: '32', isNullable: false },
          { name: 'ativo', type: 'boolean', default: true },
          { name: 'dataAdmissaoVinculo', type: 'date', isNullable: true },
          {
            name: 'criadoEm',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP(6)',
          },
          {
            name: 'atualizadoEm',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
        ],
        uniques: [
          {
            name: 'UQ_funcionario_unidade_par',
            columnNames: ['funcionarioId', 'unidade'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'funcionario_unidade',
      new TableForeignKey({
        columnNames: ['funcionarioId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'funcionarios',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createIndex(
      'funcionario_unidade',
      new TableIndex({
        name: 'idx_funcionario_unidade_unidade',
        columnNames: ['unidade'],
      }),
    );

    await queryRunner.query(`
      INSERT INTO "funcionario_unidade" ("funcionarioId", "unidade", "ativo")
      SELECT f.id, f."unidade", true FROM "funcionarios" f
    `);

    await queryRunner.query(`
      ALTER TABLE "folha_capa" DROP CONSTRAINT IF EXISTS "UQ_folha_capa_competencia"
    `);

    const funcFkRows: Array<{ constraint_name: string }> = await queryRunner.query(
      `
      SELECT tc.constraint_name AS constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = 'folha_capa'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'funcionarioId'
    `,
    );
    for (const r of funcFkRows) {
      await queryRunner.query(
        `ALTER TABLE "folha_capa" DROP CONSTRAINT IF EXISTS "${r.constraint_name}"`,
      );
    }

    await queryRunner.dropIndex('folha_capa', 'idx_folha_capa_funcionario_competencia');

    await queryRunner.addColumn(
      'folha_capa',
      new TableColumn({
        name: 'funcionarioUnidadeId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.query(`
      UPDATE "folha_capa" c
      SET "funcionarioUnidadeId" = fu.id
      FROM "funcionario_unidade" fu
      INNER JOIN "funcionarios" f ON f.id = fu."funcionarioId" AND f."unidade" = fu."unidade"
      WHERE c."funcionarioId" = f.id
    `);

    await queryRunner.dropColumn('folha_capa', 'funcionarioId');

    await queryRunner.changeColumn(
      'folha_capa',
      'funcionarioUnidadeId',
      new TableColumn({
        name: 'funcionarioUnidadeId',
        type: 'uuid',
        isNullable: false,
      }),
    );

    await queryRunner.createForeignKey(
      'folha_capa',
      new TableForeignKey({
        columnNames: ['funcionarioUnidadeId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'funcionario_unidade',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.query(`
      ALTER TABLE "folha_capa"
      ADD CONSTRAINT "UQ_folha_capa_competencia"
      UNIQUE ("funcionarioUnidadeId", ano, mes, "folhaTipoId")
    `);

    await queryRunner.createIndex(
      'folha_capa',
      new TableIndex({
        name: 'idx_folha_capa_unidade_lookup',
        columnNames: ['funcionarioUnidadeId', 'ano', 'mes', 'folhaTipoId'],
      }),
    );

    await queryRunner.dropColumn('funcionarios', 'unidade');
  }
}
