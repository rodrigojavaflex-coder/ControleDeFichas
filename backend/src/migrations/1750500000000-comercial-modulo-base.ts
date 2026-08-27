import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class ComercialModuloBase1750500000000 implements MigrationInterface {
  name = 'ComercialModuloBase1750500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const funcionarios = await queryRunner.getTable('funcionarios');
    if (funcionarios) {
      if (!funcionarios.findColumnByName('codigoVendedorErp')) {
        await queryRunner.addColumn(
          'funcionarios',
          new TableColumn({
            name: 'codigoVendedorErp',
            type: 'integer',
            isNullable: true,
          }),
        );
      }
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_funcionario_unidade_codigo_vendedor_erp"
        ON funcionarios (unidade, "codigoVendedorErp")
        WHERE "codigoVendedorErp" IS NOT NULL
      `);
    }

    if (!(await queryRunner.hasTable('comercial_meta_vendedor'))) {
      await queryRunner.createTable(
        new Table({
          name: 'comercial_meta_vendedor',
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
        'comercial_meta_vendedor',
        new TableUnique({
          name: 'uq_comercial_meta_func_ano_mes_tipo',
          columnNames: ['funcionarioId', 'anoMes', 'tipoBase'],
        }),
      );

      await queryRunner.createIndex(
        'comercial_meta_vendedor',
        new TableIndex({
          name: 'idx_comercial_meta_unidade_ano_mes',
          columnNames: ['unidade', 'anoMes'],
        }),
      );

      await queryRunner.createForeignKey(
        'comercial_meta_vendedor',
        new TableForeignKey({
          name: 'fk_comercial_meta_funcionario',
          columnNames: ['funcionarioId'],
          referencedTableName: 'funcionarios',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (!(await queryRunner.hasTable('comercial_comissao_faixa'))) {
      await queryRunner.createTable(
        new Table({
          name: 'comercial_comissao_faixa',
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
              name: 'percentualMetaDe',
              type: 'numeric',
              precision: 6,
              scale: 2,
              isNullable: false,
            },
            {
              name: 'percentualMetaAte',
              type: 'numeric',
              precision: 6,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'percentualComissao',
              type: 'numeric',
              precision: 6,
              scale: 2,
              isNullable: false,
            },
            {
              name: 'ordem',
              type: 'integer',
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

      await queryRunner.createIndex(
        'comercial_comissao_faixa',
        new TableIndex({
          name: 'idx_comercial_comissao_faixa_func_tipo',
          columnNames: ['funcionarioId', 'tipoBase'],
        }),
      );

      await queryRunner.createIndex(
        'comercial_comissao_faixa',
        new TableIndex({
          name: 'idx_comercial_comissao_faixa_ordem',
          columnNames: ['ordem'],
        }),
      );

      await queryRunner.createForeignKey(
        'comercial_comissao_faixa',
        new TableForeignKey({
          name: 'fk_comercial_comissao_faixa_funcionario',
          columnNames: ['funcionarioId'],
          referencedTableName: 'funcionarios',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const faixa = await queryRunner.getTable('comercial_comissao_faixa');
    if (faixa) {
      const fk = faixa.foreignKeys.find(
        (k) => k.name === 'fk_comercial_comissao_faixa_funcionario',
      );
      if (fk) await queryRunner.dropForeignKey('comercial_comissao_faixa', fk);
      await queryRunner.dropTable('comercial_comissao_faixa');
    }

    const meta = await queryRunner.getTable('comercial_meta_vendedor');
    if (meta) {
      const fk = meta.foreignKeys.find(
        (k) => k.name === 'fk_comercial_meta_funcionario',
      );
      if (fk) await queryRunner.dropForeignKey('comercial_meta_vendedor', fk);
      await queryRunner.dropTable('comercial_meta_vendedor');
    }

    const funcionarios = await queryRunner.getTable('funcionarios');
    if (funcionarios) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "uq_funcionario_unidade_codigo_vendedor_erp"`,
      );
      if (funcionarios.findColumnByName('codigoVendedorErp')) {
        await queryRunner.dropColumn('funcionarios', 'codigoVendedorErp');
      }
    }
  }
}
