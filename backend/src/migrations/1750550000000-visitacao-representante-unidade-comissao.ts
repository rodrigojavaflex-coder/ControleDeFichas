import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Unidades que entram no card / comissão / % meta / projeção do representante.
 * Sem alteração em perfil.permissoes.
 */
export class VisitacaoRepresentanteUnidadeComissao1750550000000
  implements MigrationInterface
{
  name = 'VisitacaoRepresentanteUnidadeComissao1750550000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('visitacao_representante_unidade_comissao')) {
      return;
    }
    await queryRunner.createTable(
      new Table({
        name: 'visitacao_representante_unidade_comissao',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'funcionarioId', type: 'uuid' },
          { name: 'unidade', type: 'varchar', length: '32' },
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
    await queryRunner.createIndex(
      'visitacao_representante_unidade_comissao',
      new TableIndex({
        name: 'uq_visitacao_rep_unid_comissao',
        columnNames: ['funcionarioId', 'unidade'],
        isUnique: true,
      }),
    );
    await queryRunner.createForeignKey(
      'visitacao_representante_unidade_comissao',
      new TableForeignKey({
        name: 'fk_visitacao_rep_unid_comissao_func',
        columnNames: ['funcionarioId'],
        referencedTableName: 'funcionarios',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('visitacao_representante_unidade_comissao'))) {
      return;
    }
    await queryRunner.dropForeignKey(
      'visitacao_representante_unidade_comissao',
      'fk_visitacao_rep_unid_comissao_func',
    );
    await queryRunner.dropIndex(
      'visitacao_representante_unidade_comissao',
      'uq_visitacao_rep_unid_comissao',
    );
    await queryRunner.dropTable('visitacao_representante_unidade_comissao');
  }
}
