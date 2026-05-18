import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
} from 'typeorm';

/** Campo opcional `setor` no cadastro de funcionários da folha. */
export class FuncionarioSetor1740995000000 implements MigrationInterface {
  name = 'FuncionarioSetor1740995000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'funcionarios',
      new TableColumn({
        name: 'setor',
        type: 'varchar',
        length: '120',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('funcionarios', 'setor');
  }
}
