import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
} from 'typeorm';

/** Remove `salarioBase` do cadastro de funcionário (valor passa a derivar só de eventos/itens de folha). */
export class FuncionarioRemoveSalarioBase1740996400000 implements MigrationInterface {
  name = 'FuncionarioRemoveSalarioBase1740996400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('funcionarios', 'salarioBase');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'funcionarios',
      new TableColumn({
        name: 'salarioBase',
        type: 'decimal',
        precision: 12,
        scale: 2,
        isNullable: true,
      }),
    );
  }
}
