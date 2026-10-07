import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Desconto de varejo do ERP (FC31110.VRDSCV / VRDSCG) para o card
 * de marca própria alinhar ao PDF (Considera Varejo com Desconto = Sim).
 */
export class CaixaDescontoVarejo1750630000000 implements MigrationInterface {
  name = 'CaixaDescontoVarejo1750630000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'caixa_itens_erp'
        AND column_name = 'valor_desconto_varejo'
      LIMIT 1
    `);
    if (!has?.length) {
      await queryRunner.query(`
        ALTER TABLE caixa_itens_erp
        ADD COLUMN valor_desconto_varejo numeric(15,2) NOT NULL DEFAULT 0
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const has = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'caixa_itens_erp'
        AND column_name = 'valor_desconto_varejo'
      LIMIT 1
    `);
    if (has?.length) {
      await queryRunner.query(`
        ALTER TABLE caixa_itens_erp DROP COLUMN valor_desconto_varejo
      `);
    }
  }
}
