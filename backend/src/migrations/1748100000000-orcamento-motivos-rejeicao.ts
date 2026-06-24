import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class OrcamentoMotivosRejeicao1748100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const motivosTable = await queryRunner.getTable('orcamento_motivo_rejeicao');
    if (!motivosTable) {
      await queryRunner.createTable(
        new Table({
          name: 'orcamento_motivo_rejeicao',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'descricao',
              type: 'varchar',
              length: '200',
              isNullable: false,
            },
            {
              name: 'ativo',
              type: 'boolean',
              default: true,
              isNullable: false,
            },
            {
              name: 'criadoEm',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
            {
              name: 'atualizadoEm',
              type: 'timestamp',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
          ],
        }),
        true,
      );
      console.log('✅ Tabela orcamento_motivo_rejeicao criada');
    }

    const orcamentosTable = await queryRunner.getTable('orcamentos');
    if (orcamentosTable && !orcamentosTable.findColumnByName('motivoRejeicaoId')) {
      await queryRunner.addColumn(
        'orcamentos',
        new TableColumn({
          name: 'motivoRejeicaoId',
          type: 'uuid',
          isNullable: true,
        }),
      );
      await queryRunner.addColumn(
        'orcamentos',
        new TableColumn({
          name: 'observacaoRejeicao',
          type: 'text',
          isNullable: true,
        }),
      );

      const fkExists = orcamentosTable.foreignKeys.some(
        (fk) => fk.columnNames.indexOf('motivoRejeicaoId') !== -1,
      );
      if (!fkExists) {
        await queryRunner.createForeignKey(
          'orcamentos',
          new TableForeignKey({
            name: 'fk_orcamentos_motivo_rejeicao',
            columnNames: ['motivoRejeicaoId'],
            referencedTableName: 'orcamento_motivo_rejeicao',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
        );
      }

      const idxExists = orcamentosTable.indices.some(
        (idx) => idx.name === 'idx_orcamentos_motivo_rejeicao',
      );
      if (!idxExists) {
        await queryRunner.createIndex(
          'orcamentos',
          new TableIndex({
            name: 'idx_orcamentos_motivo_rejeicao',
            columnNames: ['motivoRejeicaoId'],
          }),
        );
      }

      console.log('✅ Colunas motivoRejeicaoId e observacaoRejeicao adicionadas em orcamentos');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const orcamentosTable = await queryRunner.getTable('orcamentos');
    if (orcamentosTable?.findColumnByName('motivoRejeicaoId')) {
      const fk = orcamentosTable.foreignKeys.find(
        (f) => f.columnNames.indexOf('motivoRejeicaoId') !== -1,
      );
      if (fk) {
        await queryRunner.dropForeignKey('orcamentos', fk);
      }
      const idx = orcamentosTable.indices.find(
        (i) => i.name === 'idx_orcamentos_motivo_rejeicao',
      );
      if (idx) {
        await queryRunner.dropIndex('orcamentos', idx);
      }
      await queryRunner.dropColumn('orcamentos', 'observacaoRejeicao');
      await queryRunner.dropColumn('orcamentos', 'motivoRejeicaoId');
    }

    const motivosTable = await queryRunner.getTable('orcamento_motivo_rejeicao');
    if (motivosTable) {
      await queryRunner.dropTable('orcamento_motivo_rejeicao');
    }
  }
}
