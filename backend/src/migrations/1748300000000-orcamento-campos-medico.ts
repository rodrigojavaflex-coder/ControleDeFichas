import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class OrcamentoCamposMedico1748300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('orcamentos');
    if (!table) {
      console.log('⚠️  Tabela orcamentos não existe; migração ignorada');
      return;
    }

    const columns: TableColumn[] = [
      new TableColumn({
        name: 'nomeMedico',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
      new TableColumn({
        name: 'crmMedico',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
      new TableColumn({
        name: 'ufcrmMedico',
        type: 'varchar',
        length: '2',
        isNullable: true,
      }),
    ];

    for (const column of columns) {
      if (!table.findColumnByName(column.name)) {
        await queryRunner.addColumn('orcamentos', column);
        console.log(`✅ Coluna ${column.name} adicionada em orcamentos`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('orcamentos');
    if (!table) {
      return;
    }

    for (const name of ['ufcrmMedico', 'crmMedico', 'nomeMedico']) {
      if (table.findColumnByName(name)) {
        await queryRunner.dropColumn('orcamentos', name);
        console.log(`✅ Coluna ${name} removida de orcamentos`);
      }
    }
  }
}
