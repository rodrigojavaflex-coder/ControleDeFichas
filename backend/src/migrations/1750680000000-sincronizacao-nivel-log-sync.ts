import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Política de persistência de logs da sync por agente:
 * todos | alertas | erros | nao_gravar (default: todos).
 */
export class SincronizacaoNivelLogSync1750680000000
  implements MigrationInterface
{
  name = 'SincronizacaoNivelLogSync1750680000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'sincronizacao_config'
        AND column_name = 'nivelLogSync'
      LIMIT 1
    `);
    if (!has?.length) {
      await queryRunner.query(`
        ALTER TABLE sincronizacao_config
        ADD COLUMN "nivelLogSync" varchar(20) NOT NULL DEFAULT 'todos'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'sincronizacao_config'
        AND column_name = 'nivelLogSync'
      LIMIT 1
    `);
    if (has?.length) {
      await queryRunner.query(`
        ALTER TABLE sincronizacao_config
        DROP COLUMN "nivelLogSync"
      `);
    }
  }
}
