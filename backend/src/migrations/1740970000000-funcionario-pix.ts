import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
} from 'typeorm';

/** Pix no cadastro de funcionários; colunas camelCase como o restante da tabela `funcionarios`. */
export class FuncionarioPix1740970000000 implements MigrationInterface {
  name = 'FuncionarioPix1740970000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'funcionarios',
      new TableColumn({
        name: 'tipoPix',
        type: 'varchar',
        length: '32',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'funcionarios',
      new TableColumn({
        name: 'chavePix',
        type: 'varchar',
        length: '200',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('funcionarios', 'chavePix');
    await queryRunner.dropColumn('funcionarios', 'tipoPix');
  }
}
