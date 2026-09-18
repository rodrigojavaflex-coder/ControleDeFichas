import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices GIN/pg_trgm para GET /auditoria?search= (descrição + JSON auditado).
 * A expressão translate(lower(...)) DEVE coincidir com AuditoriaService.unaccentSql.
 * Sem CONCURRENTLY: TypeORM roda cada migration em transação.
 */
export class AuditoriaSearchTrgm1750590000000 implements MigrationInterface {
  name = 'AuditoriaSearchTrgm1750590000000';

  private static readonly ACCENT_FROM = 'áàâãäéèêëíìîïóòôõöúùûüçñý';
  private static readonly ACCENT_TO = 'aaaaaeeeeiiiiooooouuuucny';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    if (!(await queryRunner.hasTable('auditoria'))) {
      return;
    }

    const from = AuditoriaSearchTrgm1750590000000.ACCENT_FROM;
    const to = AuditoriaSearchTrgm1750590000000.ACCENT_TO;

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auditoria_descricao_trgm
      ON auditoria
      USING gin (
        translate(lower(COALESCE(descricao, '')), '${from}', '${to}')
        gin_trgm_ops
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auditoria_dados_anteriores_trgm
      ON auditoria
      USING gin (
        translate(
          lower(COALESCE(CAST("dadosAnteriores" AS text), '')),
          '${from}',
          '${to}'
        )
        gin_trgm_ops
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_auditoria_dados_novos_trgm
      ON auditoria
      USING gin (
        translate(
          lower(COALESCE(CAST("dadosNovos" AS text), '')),
          '${from}',
          '${to}'
        )
        gin_trgm_ops
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_auditoria_dados_novos_trgm`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_auditoria_dados_anteriores_trgm`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_auditoria_descricao_trgm`);
  }
}
