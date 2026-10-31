import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Nome da revenda/produto no lote CONVENIO-DINHEIRO (linhas PRODUTO).
 * Idempotente: a tabela pode ter sido criada pela 175082 sem esta coluna.
 */
export class CaixaPagamentoConvenioItemDescricao1750840000000
  implements MigrationInterface
{
  name = 'CaixaPagamentoConvenioItemDescricao1750840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable(
      'caixa_pagamento_convenio_item',
    );
    if (!hasTable) {
      return;
    }
    const hasCol = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'caixa_pagamento_convenio_item'
        AND column_name = 'descricao_item'
      LIMIT 1
    `);
    if (!hasCol?.length) {
      await queryRunner.query(`
        ALTER TABLE caixa_pagamento_convenio_item
        ADD COLUMN descricao_item varchar(500) NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasTable = await queryRunner.hasTable(
      'caixa_pagamento_convenio_item',
    );
    if (!hasTable) {
      return;
    }
    const hasCol = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'caixa_pagamento_convenio_item'
        AND column_name = 'descricao_item'
      LIMIT 1
    `);
    if (hasCol?.length) {
      await queryRunner.query(`
        ALTER TABLE caixa_pagamento_convenio_item
        DROP COLUMN descricao_item
      `);
    }
  }
}
