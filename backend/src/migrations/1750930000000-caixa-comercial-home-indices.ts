import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices da home comercial. Mesmas linhas, só o plano de busca.
 * Sem CONCURRENTLY: migrationsTransactionMode each ainda abre transação por migration.
 */
export class CaixaComercialHomeIndices1750930000000
  implements MigrationInterface
{
  name = 'CaixaComercialHomeIndices1750930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('caixa_itens_erp')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_caixa_itens_erp_unidade_data_req
        ON caixa_itens_erp (unidade, data_operacao, numero_requisicao)
      `);
    }

    if (await queryRunner.hasTable('caixa_requisicoes_pagas')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_caixa_req_pagas_unidade_data_req
        ON caixa_requisicoes_pagas (unidade, data_pagamento, numero_requisicao)
      `);
    }

    if (await queryRunner.hasTable('caixa_pagamento_convenio_item')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_caixa_conv_item_unidade_tipo_req
        ON caixa_pagamento_convenio_item (unidade, tipo_item, numero_requisicao)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_caixa_conv_item_unidade_tipo_req`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_caixa_req_pagas_unidade_data_req`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_caixa_itens_erp_unidade_data_req`,
    );
  }
}
