import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDataSaldoCaixaSaldoInicial1748800003000
  implements MigrationInterface
{
  name = 'AddDataSaldoCaixaSaldoInicial1748800003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('caixa_saldo_inicial_unidade');
    if (!table) {
      return;
    }

    const hasColumn = table.columns.some(
      (column) => column.name === 'data_saldo',
    );
    if (!hasColumn) {
      await queryRunner.addColumn(
        'caixa_saldo_inicial_unidade',
        new TableColumn({
          name: 'data_saldo',
          type: 'date',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('caixa_saldo_inicial_unidade');
    if (!table) {
      return;
    }

    const hasColumn = table.columns.some(
      (column) => column.name === 'data_saldo',
    );
    if (hasColumn) {
      await queryRunner.dropColumn('caixa_saldo_inicial_unidade', 'data_saldo');
    }
  }
}
