import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableUnique,
} from 'typeorm';

export class ComercialMetaUnidadePolitica1750520000000
  implements MigrationInterface
{
  name = 'ComercialMetaUnidadePolitica1750520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('comercial_meta_unidade'))) {
      await queryRunner.createTable(
        new Table({
          name: 'comercial_meta_unidade',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'anoMes',
              type: 'varchar',
              length: '7',
              isNullable: false,
            },
            {
              name: 'unidade',
              type: 'varchar',
              length: '32',
              isNullable: false,
            },
            {
              name: 'tipoBase',
              type: 'varchar',
              length: '20',
              isNullable: false,
            },
            {
              name: 'valorMeta',
              type: 'numeric',
              precision: 14,
              scale: 2,
              default: 0,
            },
            {
              name: 'criadoEm',
              type: 'timestamptz',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'atualizadoEm',
              type: 'timestamptz',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true,
      );

      await queryRunner.createUniqueConstraint(
        'comercial_meta_unidade',
        new TableUnique({
          name: 'uq_comercial_meta_unidade_ano_mes_tipo',
          columnNames: ['unidade', 'anoMes', 'tipoBase'],
        }),
      );
    }

    if (!(await queryRunner.hasTable('comercial_comissao_politica'))) {
      await queryRunner.createTable(
        new Table({
          name: 'comercial_comissao_politica',
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
              name: 'tipoBase',
              type: 'varchar',
              length: '20',
              isNullable: false,
            },
            {
              name: 'incidencia',
              type: 'varchar',
              length: '20',
              default: `'PROPRIAS'`,
              isNullable: false,
            },
            {
              name: 'percentualMinimoLoja',
              type: 'numeric',
              precision: 6,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'criadoEm',
              type: 'timestamptz',
              default: 'CURRENT_TIMESTAMP',
            },
            {
              name: 'atualizadoEm',
              type: 'timestamptz',
              default: 'CURRENT_TIMESTAMP',
            },
          ],
        }),
        true,
      );

      await queryRunner.createUniqueConstraint(
        'comercial_comissao_politica',
        new TableUnique({
          name: 'uq_comercial_comissao_politica_func_tipo',
          columnNames: ['funcionarioId', 'tipoBase'],
        }),
      );

      await queryRunner.createForeignKey(
        'comercial_comissao_politica',
        new TableForeignKey({
          name: 'fk_comercial_comissao_politica_funcionario',
          columnNames: ['funcionarioId'],
          referencedTableName: 'funcionarios',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('comercial_comissao_politica')) {
      await queryRunner.dropTable('comercial_comissao_politica');
    }
    if (await queryRunner.hasTable('comercial_meta_unidade')) {
      await queryRunner.dropTable('comercial_meta_unidade');
    }
  }
}
