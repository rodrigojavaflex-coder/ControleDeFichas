import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Overlap/lookback configurável da sync de etapas (PCP + exclusões + agendamento).
 * Default 5 dias (antes era constante 2 no código).
 */
export class SincronizacaoOverlapDiasProducaoEtapas1750660000000
  implements MigrationInterface
{
  name = 'SincronizacaoOverlapDiasProducaoEtapas1750660000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'sincronizacao_config'
        AND column_name = 'overlapDiasProducaoEtapas'
      LIMIT 1
    `);
    if (!has?.length) {
      await queryRunner.query(`
        ALTER TABLE sincronizacao_config
        ADD COLUMN "overlapDiasProducaoEtapas" integer NOT NULL DEFAULT 5
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'sincronizacao_config'
        AND column_name = 'overlapDiasProducaoEtapas'
      LIMIT 1
    `);
    if (has?.length) {
      await queryRunner.query(`
        ALTER TABLE sincronizacao_config
        DROP COLUMN "overlapDiasProducaoEtapas"
      `);
    }
  }
}
