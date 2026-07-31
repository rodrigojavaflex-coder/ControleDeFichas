import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProducaoEtapaFilaOperacional1749600000000
  implements MigrationInterface
{
  name = 'ProducaoEtapaFilaOperacional1749600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('producao_etapas_resumo');
    if (!table) {
      return;
    }

    if (!table.findColumnByName('emAndamentoFila')) {
      await queryRunner.query(`
        ALTER TABLE producao_etapas_resumo
        ADD COLUMN "emAndamentoFila" boolean NOT NULL DEFAULT false
      `);
    }
    if (!table.findColumnByName('usuarioEntradaFila')) {
      await queryRunner.query(`
        ALTER TABLE producao_etapas_resumo
        ADD COLUMN "usuarioEntradaFila" integer NULL
      `);
    }
    if (!table.findColumnByName('dataEntradaFila')) {
      await queryRunner.query(`
        ALTER TABLE producao_etapas_resumo
        ADD COLUMN "dataEntradaFila" date NULL
      `);
    }
    if (!table.findColumnByName('horaEntradaFila')) {
      await queryRunner.query(`
        ALTER TABLE producao_etapas_resumo
        ADD COLUMN "horaEntradaFila" varchar(8) NULL
      `);
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_producao_etapa_fila_andamento
      ON producao_etapas_resumo ("unidade", "emAndamentoFila")
      WHERE "emAndamentoFila" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_producao_etapa_fila_andamento
    `);
    const table = await queryRunner.getTable('producao_etapas_resumo');
    if (!table) {
      return;
    }
    for (const col of [
      'horaEntradaFila',
      'dataEntradaFila',
      'usuarioEntradaFila',
      'emAndamentoFila',
    ]) {
      if (table.findColumnByName(col)) {
        await queryRunner.query(`
          ALTER TABLE producao_etapas_resumo DROP COLUMN "${col}"
        `);
      }
    }
  }
}
