import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * CRM/UF do prescritor no item de produto (FC31110 / capa FC31100).
 * Usado na marca própria da visitação (RN-VIS-014).
 */
export class CaixaItemCrmMedicoMarcaPropria1750810000000
  implements MigrationInterface
{
  name = 'CaixaItemCrmMedicoMarcaPropria1750810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasCrm = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'caixa_itens_erp' AND column_name = 'crm_medico'
    `);
    if (!hasCrm?.length) {
      await queryRunner.query(`
        ALTER TABLE caixa_itens_erp
          ADD COLUMN crm_medico varchar(20) NULL,
          ADD COLUMN uf_crm_medico varchar(2) NULL
      `);
    }
    const hasIdx = await queryRunner.query(`
      SELECT 1 FROM pg_indexes
      WHERE tablename = 'caixa_itens_erp'
        AND indexname = 'idx_caixa_itens_erp_mp_crm'
    `);
    if (!hasIdx?.length) {
      await queryRunner.query(`
        CREATE INDEX idx_caixa_itens_erp_mp_crm
          ON caixa_itens_erp (unidade, tipo_item, data_operacao)
          WHERE tipo_item = 'PRODUTO'
            AND crm_medico IS NOT NULL
            AND uf_crm_medico IS NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_caixa_itens_erp_mp_crm
    `);
    const hasCrm = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'caixa_itens_erp' AND column_name = 'crm_medico'
    `);
    if (hasCrm?.length) {
      await queryRunner.query(`
        ALTER TABLE caixa_itens_erp
          DROP COLUMN IF EXISTS uf_crm_medico,
          DROP COLUMN IF EXISTS crm_medico
      `);
    }
  }
}
