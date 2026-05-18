import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class FolhaPagamentoBase1740100000000 implements MigrationInterface {
  name = 'FolhaPagamentoBase1740100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "folha_movimento_tipo_enum" AS ENUM ('RECEITA', 'DESPESA')`,
    );

    await queryRunner.createTable(
      new Table({
        name: 'funcionarios',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'nome', type: 'varchar', length: '200', isNullable: false },
          { name: 'cpf', type: 'varchar', length: '14', isNullable: true },
          { name: 'dataNascimento', type: 'date', isNullable: true },
          { name: 'dataAdmissao', type: 'date', isNullable: true },
          { name: 'dataDemissao', type: 'date', isNullable: true },
          {
            name: 'salarioBase',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          },
          { name: 'cargo', type: 'varchar', length: '150', isNullable: true },
          { name: 'ativo', type: 'boolean', default: true },
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
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'folha_tipo',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'descricao', type: 'varchar', length: '120', isNullable: false },
          { name: 'ativo', type: 'boolean', default: true },
          { name: 'ordenacao', type: 'int', default: 0 },
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
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'folha_verba',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'descricao', type: 'varchar', length: '200', isNullable: false },
          {
            name: 'tipoMovimento',
            type: 'folha_movimento_tipo_enum',
            isNullable: false,
          },
          { name: 'ativo', type: 'boolean', default: true },
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
      }),
      true,
    );

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
          {
            name: 'unidade',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
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

    await queryRunner.createTable(
      new Table({
        name: 'folha_fechamento',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'ano', type: 'int', isNullable: false },
          { name: 'mes', type: 'int', isNullable: false },
          { name: 'folhaTipoId', type: 'uuid', isNullable: false },
          {
            name: 'unidade',
            type: 'varchar',
            length: '32',
            isNullable: false,
          },
          { name: 'fechado', type: 'boolean', default: false },
          { name: 'fechadoEm', type: 'timestamp', isNullable: true },
          { name: 'fechadoPorId', type: 'uuid', isNullable: true },
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
            name: 'UQ_folha_fechamento_lote',
            columnNames: ['ano', 'mes', 'folhaTipoId', 'unidade'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'folha_fechamento',
      new TableForeignKey({
        columnNames: ['folhaTipoId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'folha_tipo',
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'folha_fechamento',
      new TableForeignKey({
        columnNames: ['fechadoPorId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'usuarios',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndex(
      'folha_fechamento',
      new TableIndex({
        name: 'idx_folha_fechamento_lookup',
        columnNames: ['unidade', 'ano', 'mes'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'folha_capa',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'funcionarioUnidadeId', type: 'uuid', isNullable: false },
          { name: 'ano', type: 'int', isNullable: false },
          { name: 'mes', type: 'int', isNullable: false },
          { name: 'folhaTipoId', type: 'uuid', isNullable: false },
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
            name: 'UQ_folha_capa_competencia',
            columnNames: [
              'funcionarioUnidadeId',
              'ano',
              'mes',
              'folhaTipoId',
            ],
          },
        ],
      }),
      true,
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

    await queryRunner.createForeignKey(
      'folha_capa',
      new TableForeignKey({
        columnNames: ['folhaTipoId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'folha_tipo',
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createIndex(
      'folha_capa',
      new TableIndex({
        name: 'idx_folha_capa_competencia',
        columnNames: ['ano', 'mes'],
      }),
    );

    await queryRunner.createIndex(
      'folha_capa',
      new TableIndex({
        name: 'idx_folha_capa_unidade_lookup',
        columnNames: ['funcionarioUnidadeId', 'ano', 'mes', 'folhaTipoId'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'folha_item',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'folhaCapaId', type: 'uuid', isNullable: false },
          { name: 'folhaVerbaId', type: 'uuid', isNullable: false },
          {
            name: 'valor',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: false,
          },
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
            name: 'UQ_folha_item_verba_capa',
            columnNames: ['folhaCapaId', 'folhaVerbaId'],
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'folha_item',
      new TableForeignKey({
        columnNames: ['folhaCapaId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'folha_capa',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'folha_item',
      new TableForeignKey({
        columnNames: ['folhaVerbaId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'folha_verba',
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createIndex(
      'folha_item',
      new TableIndex({
        name: 'idx_folha_item_capa',
        columnNames: ['folhaCapaId'],
      }),
    );

    await queryRunner.query(`
      INSERT INTO "folha_tipo" ("id", "descricao", "ativo", "ordenacao", "criadoEm", "atualizadoEm")
      VALUES
        (uuid_generate_v4(), 'Mensal', true, 1, NOW(), NOW()),
        (uuid_generate_v4(), 'Férias', true, 2, NOW(), NOW()),
        (uuid_generate_v4(), '13º salário', true, 3, NOW(), NOW()),
        (uuid_generate_v4(), 'Rescisão', true, 4, NOW(), NOW())
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('folha_item', true);
    await queryRunner.dropTable('folha_capa', true);
    await queryRunner.dropTable('folha_fechamento', true);
    await queryRunner.dropTable('funcionario_unidade', true);
    await queryRunner.dropTable('folha_verba', true);
    await queryRunner.dropTable('folha_tipo', true);
    await queryRunner.dropTable('funcionarios', true);
    await queryRunner.query(`DROP TYPE IF EXISTS "folha_movimento_tipo_enum"`);
  }
}
