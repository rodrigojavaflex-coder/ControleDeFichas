import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices para GET /producao/painel: filtro NOT EXISTS por req-fórmula e etapas finalizadas.
 */
export class ProducaoPainelResumoIndice1750000000000 implements MigrationInterface {
  name = 'ProducaoPainelResumoIndice1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasResumo = await queryRunner.hasTable('producao_etapas_resumo');
    if (!hasResumo) {
      return;
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_producao_etapa_resumo_req_formula
      ON producao_etapas_resumo (unidade, filial, requisicao, formula)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_producao_etapa_resumo_etapa_saida
      ON producao_etapas_resumo (unidade, "codEtapa")
      WHERE "dataSaida" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_producao_etapa_resumo_etapa_saida`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_producao_etapa_resumo_req_formula`,
    );
  }
}
