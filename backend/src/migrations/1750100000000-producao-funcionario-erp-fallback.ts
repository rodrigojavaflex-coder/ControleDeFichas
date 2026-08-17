import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProducaoFuncionarioErpFallback1750100000000
  implements MigrationInterface
{
  name = 'ProducaoFuncionarioErpFallback1750100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const func = await queryRunner.getTable('funcionarios');
    if (func && !func.findColumnByName('codigoFuncionarioErp')) {
      await queryRunner.query(`
        ALTER TABLE funcionarios
          ADD COLUMN "codigoFuncionarioErp" integer
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_funcionario_unidade_codigo_funcionario_erp"
        ON funcionarios (unidade, "codigoFuncionarioErp")
        WHERE "codigoFuncionarioErp" IS NOT NULL
      `);
    }

    const resumo = await queryRunner.getTable('producao_etapas_resumo');
    if (resumo) {
      await queryRunner.query(`
        ALTER TABLE producao_etapas_resumo
          ADD COLUMN IF NOT EXISTS "funcionarioEntrada" integer,
          ADD COLUMN IF NOT EXISTS "funcionarioSaida" integer
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "idx_producao_etapa_unidade_funcionario_saida"
        ON producao_etapas_resumo (unidade, "funcionarioSaida")
        WHERE "funcionarioSaida" IS NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const resumo = await queryRunner.getTable('producao_etapas_resumo');
    if (resumo) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "idx_producao_etapa_unidade_funcionario_saida"`,
      );
      await queryRunner.query(`
        ALTER TABLE producao_etapas_resumo
          DROP COLUMN IF EXISTS "funcionarioEntrada",
          DROP COLUMN IF EXISTS "funcionarioSaida"
      `);
    }

    const func = await queryRunner.getTable('funcionarios');
    if (func?.findColumnByName('codigoFuncionarioErp')) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "uq_funcionario_unidade_codigo_funcionario_erp"`,
      );
      await queryRunner.query(`
        ALTER TABLE funcionarios
          DROP COLUMN IF EXISTS "codigoFuncionarioErp"
      `);
    }
  }
}
