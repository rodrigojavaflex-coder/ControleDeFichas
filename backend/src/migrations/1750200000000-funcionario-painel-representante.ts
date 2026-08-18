import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class FuncionarioPainelRepresentante1750200000000
  implements MigrationInterface
{
  name = 'FuncionarioPainelRepresentante1750200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('funcionarios');
    if (!table) {
      console.warn('⚠️  Tabela funcionarios não existe; migração ignorada');
      return;
    }

    if (!table.findColumnByName('painelContratoRepresentante')) {
      await queryRunner.addColumn(
        'funcionarios',
        new TableColumn({
          name: 'painelContratoRepresentante',
          type: 'integer',
          isNullable: true,
        }),
      );
    }

    if (!table.findColumnByName('painelCodigoRepresentante')) {
      await queryRunner.addColumn(
        'funcionarios',
        new TableColumn({
          name: 'painelCodigoRepresentante',
          type: 'integer',
          isNullable: true,
        }),
      );
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_funcionario_unidade_painel_rep"
      ON funcionarios (unidade, "painelContratoRepresentante", "painelCodigoRepresentante")
      WHERE "painelContratoRepresentante" IS NOT NULL
        AND "painelCodigoRepresentante" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('funcionarios');
    if (!table) return;

    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_funcionario_unidade_painel_rep"`,
    );

    if (table.findColumnByName('painelCodigoRepresentante')) {
      await queryRunner.dropColumn('funcionarios', 'painelCodigoRepresentante');
    }
    if (table.findColumnByName('painelContratoRepresentante')) {
      await queryRunner.dropColumn('funcionarios', 'painelContratoRepresentante');
    }
  }
}
