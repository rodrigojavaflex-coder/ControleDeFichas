import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixCaixaFechamentoTimestampColumns1748800002000
  implements MigrationInterface
{
  name = 'FixCaixaFechamentoTimestampColumns1748800002000';

  private async renomearColunasTimestamp(
    queryRunner: QueryRunner,
    tableName: string,
  ): Promise<void> {
    if (!(await queryRunner.hasTable(tableName))) {
      return;
    }

    if (await queryRunner.hasColumn(tableName, 'criado_em')) {
      await queryRunner.query(
        `ALTER TABLE "${tableName}" RENAME COLUMN "criado_em" TO "criadoEm"`,
      );
    }

    if (await queryRunner.hasColumn(tableName, 'atualizado_em')) {
      await queryRunner.query(
        `ALTER TABLE "${tableName}" RENAME COLUMN "atualizado_em" TO "atualizadoEm"`,
      );
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.renomearColunasTimestamp(queryRunner, 'caixa_fechamento');
    await this.renomearColunasTimestamp(queryRunner, 'caixa_fechamento_linha');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of ['caixa_fechamento_linha', 'caixa_fechamento']) {
      if (!(await queryRunner.hasTable(tableName))) {
        continue;
      }

      if (await queryRunner.hasColumn(tableName, 'criadoEm')) {
        await queryRunner.query(
          `ALTER TABLE "${tableName}" RENAME COLUMN "criadoEm" TO "criado_em"`,
        );
      }

      if (await queryRunner.hasColumn(tableName, 'atualizadoEm')) {
        await queryRunner.query(
          `ALTER TABLE "${tableName}" RENAME COLUMN "atualizadoEm" TO "atualizado_em"`,
        );
      }
    }
  }
}
