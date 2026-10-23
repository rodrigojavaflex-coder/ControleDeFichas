import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vendedor prévio no item de requisição (FC12100.CDFUNRE).
 * Alimenta "Vendido hoje" no comercial enquanto o caixa ERP ainda não gerou FC17000.
 */
export class CaixaItemCodigoVendedorPrevia1750710000000
  implements MigrationInterface
{
  name = 'CaixaItemCodigoVendedorPrevia1750710000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const itemHas = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'caixa_itens_erp'
        AND column_name = 'codigo_vendedor_erp'
      LIMIT 1
    `);
    if (!itemHas?.length) {
      await queryRunner.query(`
        ALTER TABLE caixa_itens_erp
        ADD COLUMN codigo_vendedor_erp integer NULL
      `);
    }

    const idxHas = await queryRunner.query(`
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_caixa_itens_erp_unidade_data_vendedor'
      LIMIT 1
    `);
    if (!idxHas?.length) {
      await queryRunner.query(`
        CREATE INDEX idx_caixa_itens_erp_unidade_data_vendedor
        ON caixa_itens_erp (unidade, data_operacao, codigo_vendedor_erp)
        WHERE codigo_vendedor_erp IS NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const idxHas = await queryRunner.query(`
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = 'idx_caixa_itens_erp_unidade_data_vendedor'
      LIMIT 1
    `);
    if (idxHas?.length) {
      await queryRunner.query(`
        DROP INDEX IF EXISTS idx_caixa_itens_erp_unidade_data_vendedor
      `);
    }

    const itemHas = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'caixa_itens_erp'
        AND column_name = 'codigo_vendedor_erp'
      LIMIT 1
    `);
    if (itemHas?.length) {
      await queryRunner.query(`
        ALTER TABLE caixa_itens_erp DROP COLUMN codigo_vendedor_erp
      `);
    }
  }
}
