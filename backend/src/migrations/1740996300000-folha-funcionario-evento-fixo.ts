import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class FolhaFuncionarioEventoFixo1740996300000
  implements MigrationInterface
{
  name = 'FolhaFuncionarioEventoFixo1740996300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'folha_funcionario_evento_fixo',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'funcionarioId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'folhaVerbaId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'valor',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'quantidade',
            type: 'decimal',
            precision: 14,
            scale: 4,
            default: 1,
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
      }),
    );

    await queryRunner.createForeignKey(
      'folha_funcionario_evento_fixo',
      new TableForeignKey({
        name: 'FK_folha_func_ev_fixo_funcionario',
        columnNames: ['funcionarioId'],
        referencedTableName: 'funcionarios',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'folha_funcionario_evento_fixo',
      new TableForeignKey({
        name: 'FK_folha_func_ev_fixo_verba',
        columnNames: ['folhaVerbaId'],
        referencedTableName: 'folha_verba',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createIndex(
      'folha_funcionario_evento_fixo',
      new TableIndex({
        name: 'idx_folha_func_ev_fixo_func',
        columnNames: ['funcionarioId'],
      }),
    );

    await queryRunner.createUniqueConstraint(
      'folha_funcionario_evento_fixo',
      new TableUnique({
        name: 'UQ_folha_func_ev_fixo_func_verba',
        columnNames: ['funcionarioId', 'folhaVerbaId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('folha_funcionario_evento_fixo');
  }
}
