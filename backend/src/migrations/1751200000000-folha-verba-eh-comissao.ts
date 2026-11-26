import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** Marca eventos de receita que são comissão (quebra de relatório Folha geral). */
export class FolhaVerbaEhComissao1751200000000 implements MigrationInterface {
  name = 'FolhaVerbaEhComissao1751200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('folha_verba');
    if (table?.findColumnByName('ehComissao')) {
      return;
    }
    await queryRunner.addColumn(
      'folha_verba',
      new TableColumn({
        name: 'ehComissao',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('folha_verba');
    if (!table?.findColumnByName('ehComissao')) {
      return;
    }
    await queryRunner.dropColumn('folha_verba', 'ehComissao');
  }
}
