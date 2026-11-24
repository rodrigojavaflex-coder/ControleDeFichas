import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** Conta bancária PagBank (e demais) no cadastro de funcionários para arquivo XLSX. */
export class FuncionarioDadosBancarios1751100000000
  implements MigrationInterface
{
  name = 'FuncionarioDadosBancarios1751100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('funcionarios');
    if (!table) return;

    if (!table.findColumnByName('bancoNumero')) {
      await queryRunner.addColumn(
        'funcionarios',
        new TableColumn({
          name: 'bancoNumero',
          type: 'varchar',
          length: '10',
          isNullable: true,
        }),
      );
    }
    if (!table.findColumnByName('contaBancaria')) {
      await queryRunner.addColumn(
        'funcionarios',
        new TableColumn({
          name: 'contaBancaria',
          type: 'varchar',
          length: '20',
          isNullable: true,
        }),
      );
    }
    if (!table.findColumnByName('digitoConta')) {
      await queryRunner.addColumn(
        'funcionarios',
        new TableColumn({
          name: 'digitoConta',
          type: 'varchar',
          length: '2',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('funcionarios');
    if (!table) return;
    if (table.findColumnByName('digitoConta')) {
      await queryRunner.dropColumn('funcionarios', 'digitoConta');
    }
    if (table.findColumnByName('contaBancaria')) {
      await queryRunner.dropColumn('funcionarios', 'contaBancaria');
    }
    if (table.findColumnByName('bancoNumero')) {
      await queryRunner.dropColumn('funcionarios', 'bancoNumero');
    }
  }
}
