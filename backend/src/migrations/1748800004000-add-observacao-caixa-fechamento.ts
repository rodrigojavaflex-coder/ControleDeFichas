import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddObservacaoCaixaFechamento1748800004000
  implements MigrationInterface
{
  name = 'AddObservacaoCaixaFechamento1748800004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('caixa_fechamento');
    if (!table) {
      return;
    }

    const hasColumn = table.columns.some(
      (column) => column.name === 'observacao',
    );
    if (!hasColumn) {
      await queryRunner.addColumn(
        'caixa_fechamento',
        new TableColumn({
          name: 'observacao',
          type: 'text',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('caixa_fechamento');
    if (!table) {
      return;
    }

    const hasColumn = table.columns.some(
      (column) => column.name === 'observacao',
    );
    if (hasColumn) {
      await queryRunner.dropColumn('caixa_fechamento', 'observacao');
    }
  }
}
