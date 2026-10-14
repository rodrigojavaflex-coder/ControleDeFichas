import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMobileVersaoMinima1750600000000 implements MigrationInterface {
  name = 'AddMobileVersaoMinima1750600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('configuracoes');
    if (!table) {
      return;
    }
    if (table.columns.find((column) => column.name === 'mobileVersaoMinima')) {
      return;
    }

    await queryRunner.addColumn(
      'configuracoes',
      new TableColumn({
        name: 'mobileVersaoMinima',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('configuracoes');
    if (!table) {
      return;
    }
    if (table.columns.find((column) => column.name === 'mobileVersaoMinima')) {
      await queryRunner.dropColumn('configuracoes', 'mobileVersaoMinima');
    }
  }
}
