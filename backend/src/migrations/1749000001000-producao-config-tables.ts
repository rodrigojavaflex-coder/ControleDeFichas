import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class ProducaoConfigTables1749000001000 implements MigrationInterface {
  name = 'ProducaoConfigTables1749000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const etapaExists = await queryRunner.hasTable('producao_etapa_remuneracao');
    if (!etapaExists) {
      await queryRunner.createTable(
        new Table({
          name: 'producao_etapa_remuneracao',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'unidade', type: 'varchar', length: '32' },
            { name: 'codEtapa', type: 'varchar', length: '20' },
            { name: 'etapa', type: 'varchar', length: '200' },
            { name: 'posicaoEtapa', type: 'integer', default: 0 },
            { name: 'recebe', type: 'boolean', default: false },
            {
              name: 'valor',
              type: 'numeric',
              precision: 15,
              scale: 4,
              default: 0,
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
            },
          ],
        }),
        true,
      );

      await queryRunner.createUniqueConstraint(
        'producao_etapa_remuneracao',
        new TableUnique({
          name: 'uq_producao_etapa_remuneracao_unidade_cod',
          columnNames: ['unidade', 'codEtapa'],
        }),
      );

      await queryRunner.createIndex(
        'producao_etapa_remuneracao',
        new TableIndex({
          name: 'idx_producao_etapa_rem_unidade_pos',
          columnNames: ['unidade', 'posicaoEtapa'],
        }),
      );
    }

    const funcEtapaExists = await queryRunner.hasTable(
      'producao_funcionario_etapa',
    );
    if (!funcEtapaExists) {
      await queryRunner.createTable(
        new Table({
          name: 'producao_funcionario_etapa',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'unidade', type: 'varchar', length: '32' },
            { name: 'funcionarioId', type: 'uuid' },
            { name: 'codEtapa', type: 'varchar', length: '20' },
            { name: 'recebe', type: 'boolean', default: false },
            {
              name: 'criadoEm',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP(6)',
            },
            {
              name: 'atualizadoEm',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP(6)',
            },
          ],
        }),
        true,
      );

      await queryRunner.createUniqueConstraint(
        'producao_funcionario_etapa',
        new TableUnique({
          name: 'uq_producao_func_etapa_func_cod',
          columnNames: ['funcionarioId', 'codEtapa'],
        }),
      );

      await queryRunner.createIndex(
        'producao_funcionario_etapa',
        new TableIndex({
          name: 'idx_producao_func_etapa_unidade_func',
          columnNames: ['unidade', 'funcionarioId'],
        }),
      );

      await queryRunner.createForeignKey(
        'producao_funcionario_etapa',
        new TableForeignKey({
          name: 'fk_producao_func_etapa_funcionario',
          columnNames: ['funcionarioId'],
          referencedTableName: 'funcionarios',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('producao_funcionario_etapa')) {
      await queryRunner.dropTable('producao_funcionario_etapa');
    }
    if (await queryRunner.hasTable('producao_etapa_remuneracao')) {
      await queryRunner.dropTable('producao_etapa_remuneracao');
    }
  }
}
