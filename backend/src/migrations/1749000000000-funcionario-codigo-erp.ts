import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class FuncionarioCodigoErp1749000000000 implements MigrationInterface {
  name = 'FuncionarioCodigoErp1749000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('funcionarios');
    if (!table) {
      console.warn('⚠️  Tabela funcionarios não existe; migração ignorada');
      return;
    }

    if (!table.findColumnByName('codigoFuncionarioErp')) {
      await queryRunner.addColumn(
        'funcionarios',
        new TableColumn({
          name: 'codigoFuncionarioErp',
          type: 'integer',
          isNullable: true,
        }),
      );
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_funcionario_unidade_codigo_erp"
      ON funcionarios (unidade, "codigoFuncionarioErp")
      WHERE "codigoFuncionarioErp" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('funcionarios');
    if (!table) return;

    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_funcionario_unidade_codigo_erp"`,
    );

    if (table.findColumnByName('codigoFuncionarioErp')) {
      await queryRunner.dropColumn('funcionarios', 'codigoFuncionarioErp');
    }
  }
}
