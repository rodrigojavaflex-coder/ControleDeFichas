import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Flags Considerar convênios / Considerar taxas na política do vendedor
 * (cópia da unidade via Aplicar aos vendedores).
 */
export class ComercialComissaoPoliticaFlagsConvenioTaxa1750830000000
  implements MigrationInterface
{
  name = 'ComercialComissaoPoliticaFlagsConvenioTaxa1750830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.hasTable('comercial_comissao_politica');
    if (!has) {
      return;
    }
    for (const col of ['considerarConvenios', 'considerarTaxas'] as const) {
      const exists = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'comercial_comissao_politica'
          AND column_name = '${col}'
        LIMIT 1
      `);
      if (!exists?.length) {
        await queryRunner.query(`
          ALTER TABLE comercial_comissao_politica
          ADD COLUMN "${col}" boolean NOT NULL DEFAULT false
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.hasTable('comercial_comissao_politica');
    if (!has) {
      return;
    }
    for (const col of ['considerarTaxas', 'considerarConvenios'] as const) {
      const exists = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'comercial_comissao_politica'
          AND column_name = '${col}'
        LIMIT 1
      `);
      if (exists?.length) {
        await queryRunner.query(`
          ALTER TABLE comercial_comissao_politica
          DROP COLUMN "${col}"
        `);
      }
    }
  }
}
