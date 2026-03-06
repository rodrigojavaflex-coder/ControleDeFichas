import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLogoImagemToConfiguracao1739000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('configuracoes');
    if (!table) return;

    const hasLogoImagem = table.columns.find((c) => c.name === 'logoImagem');
    if (!hasLogoImagem) {
      await queryRunner.addColumn(
        'configuracoes',
        new TableColumn({
          name: 'logoImagem',
          type: 'bytea',
          isNullable: true,
        }),
      );
    }
    const hasMime = table.columns.find((c) => c.name === 'logoImagemMime');
    if (!hasMime) {
      await queryRunner.addColumn(
        'configuracoes',
        new TableColumn({
          name: 'logoImagemMime',
          type: 'varchar',
          length: '100',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('configuracoes');
    if (!table) return;
    if (table.columns.find((c) => c.name === 'logoImagem'))
      await queryRunner.dropColumn('configuracoes', 'logoImagem');
    if (table.columns.find((c) => c.name === 'logoImagemMime'))
      await queryRunner.dropColumn('configuracoes', 'logoImagemMime');
  }
}
