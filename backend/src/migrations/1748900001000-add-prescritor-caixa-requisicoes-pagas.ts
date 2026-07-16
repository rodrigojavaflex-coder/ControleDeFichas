import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPrescritorCaixaRequisicoesPagas1748900001000
  implements MigrationInterface
{
  name = 'AddPrescritorCaixaRequisicoesPagas1748900001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('caixa_requisicoes_pagas');
    if (!table) {
      console.log(
        '⚠️  Tabela caixa_requisicoes_pagas não existe; migração ignorada',
      );
      return;
    }

    const columns: TableColumn[] = [
      new TableColumn({
        name: 'nome_medico',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
      new TableColumn({
        name: 'crm_medico',
        type: 'varchar',
        length: '20',
        isNullable: true,
      }),
      new TableColumn({
        name: 'uf_crm_medico',
        type: 'varchar',
        length: '2',
        isNullable: true,
      }),
    ];

    for (const column of columns) {
      if (!table.findColumnByName(column.name)) {
        await queryRunner.addColumn('caixa_requisicoes_pagas', column);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('caixa_requisicoes_pagas');
    if (!table) {
      return;
    }

    for (const columnName of ['uf_crm_medico', 'crm_medico', 'nome_medico']) {
      if (table.findColumnByName(columnName)) {
        await queryRunner.dropColumn('caixa_requisicoes_pagas', columnName);
      }
    }
  }
}
