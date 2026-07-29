import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** Cadastro: funcionário pode existir só para produção (RN-011). */
export class FuncionarioParticipaFolhaPagamento1749600000000
  implements MigrationInterface
{
  name = 'FuncionarioParticipaFolhaPagamento1749600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('funcionarios');
    if (table?.findColumnByName('participaFolhaPagamento')) {
      return;
    }
    await queryRunner.addColumn(
      'funcionarios',
      new TableColumn({
        name: 'participaFolhaPagamento',
        type: 'boolean',
        default: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('funcionarios');
    if (!table?.findColumnByName('participaFolhaPagamento')) {
      return;
    }
    await queryRunner.dropColumn('funcionarios', 'participaFolhaPagamento');
  }
}
