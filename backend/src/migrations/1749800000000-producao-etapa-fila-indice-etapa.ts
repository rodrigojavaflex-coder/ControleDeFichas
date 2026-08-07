import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProducaoEtapaFilaIndiceEtapa1749800000000
  implements MigrationInterface
{
  name = 'ProducaoEtapaFilaIndiceEtapa1749800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_producao_etapa_fila_unidade_cod_etapa
      ON producao_etapas_resumo ("unidade", "codEtapa")
      WHERE "emAndamentoFila" = true AND "dataEntradaFila" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_producao_etapa_fila_unidade_cod_etapa
    `);
  }
}
