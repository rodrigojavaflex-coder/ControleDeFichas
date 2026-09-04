import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Retrato completo do fechamento: breakdown por filial, quantidades e
 * linhas de prescritor em outras unidades (RN-VIS-013).
 * Sem alteração em perfil.permissoes.
 */
export class VisitacaoFechamentoRetratoCompleto1750560000000
  implements MigrationInterface
{
  name = 'VisitacaoFechamentoRetratoCompleto1750560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('visitacao_fechamento')) {
      await this.addColumnIfMissing(queryRunner, 'visitacao_fechamento', {
        name: 'qtd_recebido_loja',
        type: 'int',
        default: 0,
      });
      await this.addColumnIfMissing(queryRunner, 'visitacao_fechamento', {
        name: 'qtd_rejeitado_loja',
        type: 'int',
        default: 0,
      });
      await this.addColumnIfMissing(queryRunner, 'visitacao_fechamento', {
        name: 'recebido_outras',
        type: 'numeric',
        precision: 14,
        scale: 2,
        default: 0,
      });
      await this.addColumnIfMissing(queryRunner, 'visitacao_fechamento', {
        name: 'qtd_recebido_outras',
        type: 'int',
        default: 0,
      });
      await this.addColumnIfMissing(queryRunner, 'visitacao_fechamento', {
        name: 'rejeitado_outras',
        type: 'numeric',
        precision: 14,
        scale: 2,
        default: 0,
      });
      await this.addColumnIfMissing(queryRunner, 'visitacao_fechamento', {
        name: 'qtd_rejeitado_outras',
        type: 'int',
        default: 0,
      });
    }

    if (await queryRunner.hasTable('visitacao_fechamento_representante')) {
      await this.addColumnIfMissing(
        queryRunner,
        'visitacao_fechamento_representante',
        { name: 'qtd_recebido', type: 'int', default: 0 },
      );
      await this.addColumnIfMissing(
        queryRunner,
        'visitacao_fechamento_representante',
        { name: 'qtd_rejeitado', type: 'int', default: 0 },
      );
      await this.addColumnIfMissing(
        queryRunner,
        'visitacao_fechamento_representante',
        {
          name: 'valor_recebido_outras',
          type: 'numeric',
          precision: 14,
          scale: 2,
          default: 0,
        },
      );
      await this.addColumnIfMissing(
        queryRunner,
        'visitacao_fechamento_representante',
        { name: 'qtd_recebido_outras', type: 'int', default: 0 },
      );
      await this.addColumnIfMissing(
        queryRunner,
        'visitacao_fechamento_representante',
        {
          name: 'valor_rejeitado_outras',
          type: 'numeric',
          precision: 14,
          scale: 2,
          default: 0,
        },
      );
      await this.addColumnIfMissing(
        queryRunner,
        'visitacao_fechamento_representante',
        { name: 'qtd_rejeitado_outras', type: 'int', default: 0 },
      );
      await this.addColumnIfMissing(
        queryRunner,
        'visitacao_fechamento_representante',
        {
          name: 'unidades_comissao',
          type: 'varchar',
          length: '32',
          isArray: true,
          default: `'{}'`,
        },
      );
    }

    if (await queryRunner.hasTable('visitacao_fechamento_medico')) {
      await this.addColumnIfMissing(queryRunner, 'visitacao_fechamento_medico', {
        name: 'unidade',
        type: 'varchar',
        length: '32',
        isNullable: true,
      });
      await queryRunner.query(`
        UPDATE visitacao_fechamento_medico m
        SET unidade = f.unidade
        FROM visitacao_fechamento f
        WHERE m.fechamento_id = f.id
          AND (m.unidade IS NULL OR BTRIM(m.unidade) = '')
      `);
      await queryRunner.query(`
        ALTER TABLE visitacao_fechamento_medico
        ALTER COLUMN unidade SET NOT NULL
      `);
      await this.addColumnIfMissing(queryRunner, 'visitacao_fechamento_medico', {
        name: 'unidade_carteira',
        type: 'varchar',
        length: '32',
        isNullable: true,
      });
      await this.addColumnIfMissing(queryRunner, 'visitacao_fechamento_medico', {
        name: 'movimento_fora_carteira',
        type: 'boolean',
        default: false,
      });
      await this.addColumnIfMissing(queryRunner, 'visitacao_fechamento_medico', {
        name: 'nome_representante',
        type: 'varchar',
        length: '200',
        isNullable: true,
      });
      await this.addColumnIfMissing(queryRunner, 'visitacao_fechamento_medico', {
        name: 'qtd_recebido',
        type: 'int',
        default: 0,
      });
      await this.addColumnIfMissing(queryRunner, 'visitacao_fechamento_medico', {
        name: 'qtd_rejeitado',
        type: 'int',
        default: 0,
      });

      const table = await queryRunner.getTable('visitacao_fechamento_medico');
      const oldUnique = table?.indices.find(
        (i) => i.name === 'uq_visitacao_fech_medico_crm',
      );
      if (oldUnique) {
        await queryRunner.dropIndex(
          'visitacao_fechamento_medico',
          'uq_visitacao_fech_medico_crm',
        );
      }
      const hasNewUnique = table?.indices.some(
        (i) => i.name === 'uq_visitacao_fech_medico_crm_unidade',
      );
      if (!hasNewUnique) {
        await queryRunner.createIndex(
          'visitacao_fechamento_medico',
          new TableIndex({
            name: 'uq_visitacao_fech_medico_crm_unidade',
            columnNames: [
              'fechamento_id',
              'crm_medico',
              'uf_crm_medico',
              'unidade',
            ],
            isUnique: true,
          }),
        );
      }
      const hasCrmIdx = table?.indices.some(
        (i) => i.name === 'idx_visitacao_fech_medico_crm',
      );
      if (!hasCrmIdx) {
        await queryRunner.createIndex(
          'visitacao_fechamento_medico',
          new TableIndex({
            name: 'idx_visitacao_fech_medico_crm',
            columnNames: ['crm_medico', 'uf_crm_medico'],
          }),
        );
      }
    }

    if (!(await queryRunner.hasTable('visitacao_fechamento_outra_unidade'))) {
      await queryRunner.createTable(
        new Table({
          name: 'visitacao_fechamento_outra_unidade',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'fechamento_id', type: 'uuid' },
            { name: 'unidade', type: 'varchar', length: '32' },
            {
              name: 'valor_recebido',
              type: 'numeric',
              precision: 14,
              scale: 2,
              default: 0,
            },
            { name: 'qtd_recebido', type: 'int', default: 0 },
            {
              name: 'valor_rejeitado',
              type: 'numeric',
              precision: 14,
              scale: 2,
              default: 0,
            },
            { name: 'qtd_rejeitado', type: 'int', default: 0 },
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
        'visitacao_fechamento_outra_unidade',
        new TableIndex({
          name: 'idx_visitacao_fech_outra_fechamento',
          columnNames: ['fechamento_id'],
        }),
      );
      await queryRunner.createIndex(
        'visitacao_fechamento_outra_unidade',
        new TableIndex({
          name: 'uq_visitacao_fech_outra_unidade',
          columnNames: ['fechamento_id', 'unidade'],
          isUnique: true,
        }),
      );
      await queryRunner.createForeignKey(
        'visitacao_fechamento_outra_unidade',
        new TableForeignKey({
          name: 'fk_visitacao_fech_outra_fechamento',
          columnNames: ['fechamento_id'],
          referencedTableName: 'visitacao_fechamento',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (
      !(await queryRunner.hasTable('visitacao_fechamento_representante_unidade'))
    ) {
      await queryRunner.createTable(
        new Table({
          name: 'visitacao_fechamento_representante_unidade',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'fechamento_representante_id', type: 'uuid' },
            { name: 'unidade', type: 'varchar', length: '32' },
            {
              name: 'valor',
              type: 'numeric',
              precision: 14,
              scale: 2,
              default: 0,
            },
            { name: 'quantidade', type: 'int', default: 0 },
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
        'visitacao_fechamento_representante_unidade',
        new TableIndex({
          name: 'idx_visitacao_fech_rep_unid_rep',
          columnNames: ['fechamento_representante_id'],
        }),
      );
      await queryRunner.createIndex(
        'visitacao_fechamento_representante_unidade',
        new TableIndex({
          name: 'uq_visitacao_fech_rep_unid',
          columnNames: ['fechamento_representante_id', 'unidade'],
          isUnique: true,
        }),
      );
      await queryRunner.createForeignKey(
        'visitacao_fechamento_representante_unidade',
        new TableForeignKey({
          name: 'fk_visitacao_fech_rep_unid_rep',
          columnNames: ['fechamento_representante_id'],
          referencedTableName: 'visitacao_fechamento_representante',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('visitacao_fechamento_representante_unidade')) {
      await queryRunner.dropTable(
        'visitacao_fechamento_representante_unidade',
        true,
      );
    }
    if (await queryRunner.hasTable('visitacao_fechamento_outra_unidade')) {
      await queryRunner.dropTable('visitacao_fechamento_outra_unidade', true);
    }

    if (await queryRunner.hasTable('visitacao_fechamento_medico')) {
      const table = await queryRunner.getTable('visitacao_fechamento_medico');
      if (table?.indices.some((i) => i.name === 'idx_visitacao_fech_medico_crm')) {
        await queryRunner.dropIndex(
          'visitacao_fechamento_medico',
          'idx_visitacao_fech_medico_crm',
        );
      }
      if (
        table?.indices.some(
          (i) => i.name === 'uq_visitacao_fech_medico_crm_unidade',
        )
      ) {
        await queryRunner.dropIndex(
          'visitacao_fechamento_medico',
          'uq_visitacao_fech_medico_crm_unidade',
        );
      }
      await queryRunner.createIndex(
        'visitacao_fechamento_medico',
        new TableIndex({
          name: 'uq_visitacao_fech_medico_crm',
          columnNames: ['fechamento_id', 'crm_medico', 'uf_crm_medico'],
          isUnique: true,
        }),
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento_medico',
        'qtd_rejeitado',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento_medico',
        'qtd_recebido',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento_medico',
        'nome_representante',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento_medico',
        'movimento_fora_carteira',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento_medico',
        'unidade_carteira',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento_medico',
        'unidade',
      );
    }

    if (await queryRunner.hasTable('visitacao_fechamento_representante')) {
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento_representante',
        'unidades_comissao',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento_representante',
        'qtd_rejeitado_outras',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento_representante',
        'valor_rejeitado_outras',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento_representante',
        'qtd_recebido_outras',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento_representante',
        'valor_recebido_outras',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento_representante',
        'qtd_rejeitado',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento_representante',
        'qtd_recebido',
      );
    }

    if (await queryRunner.hasTable('visitacao_fechamento')) {
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento',
        'qtd_rejeitado_outras',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento',
        'rejeitado_outras',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento',
        'qtd_recebido_outras',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento',
        'recebido_outras',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento',
        'qtd_rejeitado_loja',
      );
      await this.dropColumnIfExists(
        queryRunner,
        'visitacao_fechamento',
        'qtd_recebido_loja',
      );
    }
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    table: string,
    column: {
      name: string;
      type: string;
      length?: string;
      precision?: number;
      scale?: number;
      default?: string | number | boolean;
      isNullable?: boolean;
      isArray?: boolean;
    },
  ): Promise<void> {
    if (await queryRunner.hasColumn(table, column.name)) return;
    await queryRunner.addColumn(
      table,
      new TableColumn({
        name: column.name,
        type: column.type,
        length: column.length,
        precision: column.precision,
        scale: column.scale,
        default: column.default,
        isNullable: column.isNullable ?? false,
        isArray: column.isArray ?? false,
      }),
    );
  }

  private async dropColumnIfExists(
    queryRunner: QueryRunner,
    table: string,
    column: string,
  ): Promise<void> {
    if (await queryRunner.hasColumn(table, column)) {
      await queryRunner.dropColumn(table, column);
    }
  }
}
