import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPrescritorClienteProducaoEtapas1748900002000
  implements MigrationInterface
{
  name = 'AddPrescritorClienteProducaoEtapas1748900002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('producao_etapas_resumo');
    if (!table) {
      console.log(
        '⚠️  Tabela producao_etapas_resumo não existe; migração ignorada',
      );
      return;
    }

    const columns: TableColumn[] = [
      new TableColumn({
        name: 'codigoCliente',
        type: 'integer',
        isNullable: true,
      }),
      new TableColumn({
        name: 'crf',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
      new TableColumn({
        name: 'ufCrf',
        type: 'varchar',
        length: '2',
        isNullable: true,
      }),
      new TableColumn({
        name: 'nomePrescritor',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    ];

    for (const column of columns) {
      if (!table.findColumnByName(column.name)) {
        await queryRunner.addColumn('producao_etapas_resumo', column);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('producao_etapas_resumo');
    if (!table) {
      return;
    }

    for (const columnName of [
      'nomePrescritor',
      'ufCrf',
      'crf',
      'codigoCliente',
    ]) {
      if (table.findColumnByName(columnName)) {
        await queryRunner.dropColumn('producao_etapas_resumo', columnName);
      }
    }
  }
}
