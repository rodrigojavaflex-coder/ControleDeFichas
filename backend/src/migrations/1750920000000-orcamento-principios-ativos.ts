import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class OrcamentoPrincipiosAtivos1750920000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('orcamentos');
    if (!table) {
      console.log('⚠️  Tabela orcamentos não existe; migração ignorada');
      return;
    }

    if (!table.findColumnByName('principiosAtivos')) {
      await queryRunner.addColumn(
        'orcamentos',
        new TableColumn({
          name: 'principiosAtivos',
          type: 'text',
          isNullable: true,
        }),
      );
      console.log('✅ Coluna principiosAtivos adicionada em orcamentos');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('orcamentos');
    if (!table) {
      return;
    }

    if (table.findColumnByName('principiosAtivos')) {
      await queryRunner.dropColumn('orcamentos', 'principiosAtivos');
      console.log('✅ Coluna principiosAtivos removida de orcamentos');
    }
  }
}
