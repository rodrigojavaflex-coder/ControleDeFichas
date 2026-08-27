import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ComercialComissaoFaixaBonus1750510000000
  implements MigrationInterface
{
  name = 'ComercialComissaoFaixaBonus1750510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('comercial_comissao_faixa'))) {
      return;
    }
    if (await queryRunner.hasColumn('comercial_comissao_faixa', 'valorBonus')) {
      return;
    }
    await queryRunner.addColumn(
      'comercial_comissao_faixa',
      new TableColumn({
        name: 'valorBonus',
        type: 'numeric',
        precision: 14,
        scale: 2,
        default: 0,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('comercial_comissao_faixa'))) {
      return;
    }
    if (await queryRunner.hasColumn('comercial_comissao_faixa', 'valorBonus')) {
      await queryRunner.dropColumn('comercial_comissao_faixa', 'valorBonus');
    }
  }
}
