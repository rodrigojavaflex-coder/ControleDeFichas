import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CaixaFechamentoConsolidado1748800000000
  implements MigrationInterface
{
  name = 'CaixaFechamentoConsolidado1748800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('caixa_saldo_inicial_unidade'))) {
      await queryRunner.createTable(
        new Table({
          name: 'caixa_saldo_inicial_unidade',
          columns: [
            {
              name: 'unidade',
              type: 'varchar',
              length: '20',
              isPrimary: true,
            },
            {
              name: 'saldo_inicial',
              type: 'decimal',
              precision: 12,
              scale: 2,
              default: 0,
            },
            {
              name: 'atualizado_em',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP(6)',
            },
          ],
        }),
        true,
      );
    }

    if (!(await queryRunner.hasTable('caixa_fechamento'))) {
      await queryRunner.createTable(
        new Table({
          name: 'caixa_fechamento',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'unidade',
              type: 'varchar',
              length: '20',
              isNullable: false,
            },
            {
              name: 'data_operacao',
              type: 'date',
              isNullable: false,
            },
            {
              name: 'status',
              type: 'varchar',
              length: '20',
              default: "'RASCUNHO'",
            },
            {
              name: 'saldo_inicial',
              type: 'decimal',
              precision: 12,
              scale: 2,
              default: 0,
            },
            {
              name: 'total_despesas',
              type: 'decimal',
              precision: 12,
              scale: 2,
              default: 0,
            },
            {
              name: 'total_retirada',
              type: 'decimal',
              precision: 12,
              scale: 2,
              default: 0,
            },
            {
              name: 'saldo_final',
              type: 'decimal',
              precision: 12,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'confirmado_em',
              type: 'timestamp',
              isNullable: true,
            },
            {
              name: 'confirmado_por',
              type: 'uuid',
              isNullable: true,
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

      await queryRunner.createIndex(
        'caixa_fechamento',
        new TableIndex({
          name: 'idx_caixa_fechamento_unidade_data',
          columnNames: ['unidade', 'data_operacao'],
          isUnique: true,
        }),
      );

      await queryRunner.createIndex(
        'caixa_fechamento',
        new TableIndex({
          name: 'idx_caixa_fechamento_unidade_status_data',
          columnNames: ['unidade', 'status', 'data_operacao'],
        }),
      );
    }

    if (!(await queryRunner.hasTable('caixa_fechamento_linha'))) {
      await queryRunner.createTable(
        new Table({
          name: 'caixa_fechamento_linha',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'fechamento_id',
              type: 'uuid',
              isNullable: false,
            },
            {
              name: 'forma',
              type: 'varchar',
              length: '30',
              isNullable: false,
            },
            {
              name: 'tipo_linha',
              type: 'varchar',
              length: '20',
              isNullable: false,
            },
            {
              name: 'origem',
              type: 'varchar',
              length: '30',
              isNullable: true,
            },
            {
              name: 'qtd',
              type: 'integer',
              default: 0,
            },
            {
              name: 'valor',
              type: 'decimal',
              precision: 12,
              scale: 2,
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

      await queryRunner.createForeignKey(
        'caixa_fechamento_linha',
        new TableForeignKey({
          name: 'fk_caixa_fech_linha_fechamento',
          columnNames: ['fechamento_id'],
          referencedTableName: 'caixa_fechamento',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );

      await queryRunner.createIndex(
        'caixa_fechamento_linha',
        new TableIndex({
          name: 'idx_caixa_fech_linha_fechamento',
          columnNames: ['fechamento_id'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('caixa_fechamento_linha')) {
      await queryRunner.dropTable('caixa_fechamento_linha', true);
    }
    if (await queryRunner.hasTable('caixa_fechamento')) {
      await queryRunner.dropTable('caixa_fechamento', true);
    }
    if (await queryRunner.hasTable('caixa_saldo_inicial_unidade')) {
      await queryRunner.dropTable('caixa_saldo_inicial_unidade', true);
    }
  }
}
