import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Taxa do ERP (VRTXA) para alinhar comissão comercial ao PDF
 * (Considera Taxa = Não → abate a taxa da base).
 * Item: FC31200.VRTXA; Paga: FC17000.VRTXA.
 */
export class CaixaValorTaxa1750610000000 implements MigrationInterface {
  name = 'CaixaValorTaxa1750610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const itensHas = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'caixa_itens_erp' AND column_name = 'valor_taxa'
      LIMIT 1
    `);
    if (!itensHas?.length) {
      await queryRunner.query(`
        ALTER TABLE caixa_itens_erp
        ADD COLUMN valor_taxa numeric(15,2) NOT NULL DEFAULT 0
      `);
    }

    const pagasHas = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'caixa_requisicoes_pagas' AND column_name = 'valor_taxa'
      LIMIT 1
    `);
    if (!pagasHas?.length) {
      await queryRunner.query(`
        ALTER TABLE caixa_requisicoes_pagas
        ADD COLUMN valor_taxa numeric(15,2) NOT NULL DEFAULT 0
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const pagasHas = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'caixa_requisicoes_pagas' AND column_name = 'valor_taxa'
      LIMIT 1
    `);
    if (pagasHas?.length) {
      await queryRunner.query(`
        ALTER TABLE caixa_requisicoes_pagas DROP COLUMN valor_taxa
      `);
    }

    const itensHas = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'caixa_itens_erp' AND column_name = 'valor_taxa'
      LIMIT 1
    `);
    if (itensHas?.length) {
      await queryRunner.query(`
        ALTER TABLE caixa_itens_erp DROP COLUMN valor_taxa
      `);
    }
  }
}
