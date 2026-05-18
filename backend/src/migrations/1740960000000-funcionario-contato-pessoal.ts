import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
} from 'typeorm';

/** Contato e endereço no cadastro de funcionários (folha); colunas camelCase como o restante da tabela `funcionarios`. */
export class FuncionarioContatoPessoal1740960000000 implements MigrationInterface {
  name = 'FuncionarioContatoPessoal1740960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'funcionarios',
      new TableColumn({
        name: 'telefone',
        type: 'varchar',
        length: '40',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'funcionarios',
      new TableColumn({
        name: 'endereco',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    );
    await queryRunner.addColumn(
      'funcionarios',
      new TableColumn({
        name: 'email',
        type: 'varchar',
        length: '254',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('funcionarios', 'email');
    await queryRunner.dropColumn('funcionarios', 'endereco');
    await queryRunner.dropColumn('funcionarios', 'telefone');
  }
}
