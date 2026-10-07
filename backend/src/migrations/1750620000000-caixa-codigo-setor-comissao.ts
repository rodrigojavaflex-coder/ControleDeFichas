import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Setor do produto (FC03000.SETOR) no item de caixa.
 * A lista de setores da política de comissão fica nas migrações comerciais.
 */
export class CaixaCodigoSetorComissao1750620000000 implements MigrationInterface {
  name = 'CaixaCodigoSetorComissao1750620000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const itemHas = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'caixa_itens_erp' AND column_name = 'codigo_setor'
      LIMIT 1
    `);
    if (!itemHas?.length) {
      await queryRunner.query(`
        ALTER TABLE caixa_itens_erp
        ADD COLUMN codigo_setor integer NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const itemHas = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'caixa_itens_erp' AND column_name = 'codigo_setor'
      LIMIT 1
    `);
    if (itemHas?.length) {
      await queryRunner.query(`
        ALTER TABLE caixa_itens_erp DROP COLUMN codigo_setor
      `);
    }
  }
}
