import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Critério de ranking dos vendedores no acompanhamento comercial
 * (por % da meta ou por valor R$), configurável por unidade.
 */
export class ComercialCriterioRankingUnidade1750690000000
  implements MigrationInterface
{
  name = 'ComercialCriterioRankingUnidade1750690000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable(
      'comercial_comissao_politica_unidade',
    );
    if (!hasTable) return;

    const has = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'comercial_comissao_politica_unidade'
        AND column_name = 'criterioRanking'
      LIMIT 1
    `);
    if (!has?.length) {
      await queryRunner.query(`
        ALTER TABLE comercial_comissao_politica_unidade
        ADD COLUMN "criterioRanking" varchar(20) NOT NULL DEFAULT 'PERCENTUAL'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable(
      'comercial_comissao_politica_unidade',
    );
    if (!hasTable) return;

    const has = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'comercial_comissao_politica_unidade'
        AND column_name = 'criterioRanking'
      LIMIT 1
    `);
    if (has?.length) {
      await queryRunner.query(`
        ALTER TABLE comercial_comissao_politica_unidade
        DROP COLUMN "criterioRanking"
      `);
    }
  }
}
