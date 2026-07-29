import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProducaoUsuarioErp1749500000000 implements MigrationInterface {
  name = 'ProducaoUsuarioErp1749500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const resumo = await queryRunner.getTable('producao_etapas_resumo');
    if (resumo) {
      await queryRunner.query(`
        ALTER TABLE producao_etapas_resumo
          DROP COLUMN IF EXISTS "codFuncEntrada",
          DROP COLUMN IF EXISTS "funcEntrada",
          DROP COLUMN IF EXISTS "codFuncSaida",
          DROP COLUMN IF EXISTS "funcSaida"
      `);
      await queryRunner.query(`
        ALTER TABLE producao_etapas_resumo
          ADD COLUMN IF NOT EXISTS "usuarioEntrada" integer,
          ADD COLUMN IF NOT EXISTS "usuarioSaida" integer
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "idx_producao_etapa_unidade_usuario_saida"
        ON producao_etapas_resumo (unidade, "usuarioSaida")
        WHERE "usuarioSaida" IS NOT NULL
      `);
    } else {
      console.warn(
        '⚠️  Tabela producao_etapas_resumo não existe; migração parcial ignorada',
      );
    }

    const func = await queryRunner.getTable('funcionarios');
    if (!func) {
      console.warn('⚠️  Tabela funcionarios não existe; migração parcial ignorada');
      return;
    }

    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_funcionario_unidade_codigo_erp"`,
    );

    if (func.findColumnByName('codigoFuncionarioErp')) {
      await queryRunner.query(`
        ALTER TABLE funcionarios
          RENAME COLUMN "codigoFuncionarioErp" TO "codigoUsuarioErp"
      `);
    } else if (!func.findColumnByName('codigoUsuarioErp')) {
      await queryRunner.query(`
        ALTER TABLE funcionarios
          ADD COLUMN "codigoUsuarioErp" integer
      `);
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_funcionario_unidade_codigo_usuario_erp"
      ON funcionarios (unidade, "codigoUsuarioErp")
      WHERE "codigoUsuarioErp" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const resumo = await queryRunner.getTable('producao_etapas_resumo');
    if (resumo) {
      await queryRunner.query(
        `DROP INDEX IF EXISTS "idx_producao_etapa_unidade_usuario_saida"`,
      );
      await queryRunner.query(`
        ALTER TABLE producao_etapas_resumo
          DROP COLUMN IF EXISTS "usuarioEntrada",
          DROP COLUMN IF EXISTS "usuarioSaida"
      `);
      await queryRunner.query(`
        ALTER TABLE producao_etapas_resumo
          ADD COLUMN IF NOT EXISTS "codFuncEntrada" integer,
          ADD COLUMN IF NOT EXISTS "funcEntrada" varchar(500),
          ADD COLUMN IF NOT EXISTS "codFuncSaida" integer,
          ADD COLUMN IF NOT EXISTS "funcSaida" varchar(500)
      `);
    }

    const func = await queryRunner.getTable('funcionarios');
    if (!func) return;

    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_funcionario_unidade_codigo_usuario_erp"`,
    );

    if (func.findColumnByName('codigoUsuarioErp')) {
      await queryRunner.query(`
        ALTER TABLE funcionarios
          RENAME COLUMN "codigoUsuarioErp" TO "codigoFuncionarioErp"
      `);
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_funcionario_unidade_codigo_erp"
      ON funcionarios (unidade, "codigoFuncionarioErp")
      WHERE "codigoFuncionarioErp" IS NOT NULL
    `);
  }
}
