import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 1) Detalhe do lote CONVENIO-DINHEIRO (FC17110/FC14200) — só enriquecimento.
 * 2) Flags da unidade: considerarConvênios / considerarTaxas no comercial.
 */
export class CaixaPagamentoConvenioItemEFlagsComercial1750820000000
  implements MigrationInterface
{
  name = 'CaixaPagamentoConvenioItemEFlagsComercial1750820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasConv = await queryRunner.hasTable('caixa_pagamento_convenio_item');
    if (!hasConv) {
      await queryRunner.query(`
        CREATE TABLE caixa_pagamento_convenio_item (
          id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
          chave_erp varchar(120) NOT NULL,
          pagamento_id uuid NOT NULL
            REFERENCES caixa_pagamentos_erp(id) ON DELETE CASCADE,
          unidade varchar(20) NOT NULL,
          data_recebimento date NOT NULL,
          tipo_item varchar(20) NOT NULL,
          numero_requisicao integer NULL,
          numero_cupom_origem integer NULL,
          descricao_item varchar(500) NULL,
          codigo_cliente integer NULL,
          nome_cliente varchar(200) NULL,
          codigo_vendedor integer NULL,
          nome_vendedor varchar(200) NULL,
          codigo_setor integer NULL,
          valor numeric(15,2) NOT NULL,
          data_origem date NULL,
          importado_em timestamptz NOT NULL DEFAULT NOW(),
          atualizado_em timestamptz NOT NULL DEFAULT NOW()
        )
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX uq_caixa_pag_conv_item_chave
          ON caixa_pagamento_convenio_item (chave_erp)
      `);
      await queryRunner.query(`
        CREATE INDEX idx_caixa_pag_conv_item_pag
          ON caixa_pagamento_convenio_item (pagamento_id)
      `);
      await queryRunner.query(`
        CREATE INDEX idx_caixa_pag_conv_item_unidade_data
          ON caixa_pagamento_convenio_item (unidade, data_recebimento)
      `);
      await queryRunner.query(`
        CREATE INDEX idx_caixa_pag_conv_item_req
          ON caixa_pagamento_convenio_item (unidade, numero_requisicao)
      `);
    } else {
      const hasDescricao = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'caixa_pagamento_convenio_item'
          AND column_name = 'descricao_item'
        LIMIT 1
      `);
      if (!hasDescricao?.length) {
        await queryRunner.query(`
          ALTER TABLE caixa_pagamento_convenio_item
          ADD COLUMN descricao_item varchar(500) NULL
        `);
      }
    }

    const hasPolitica = await queryRunner.hasTable(
      'comercial_comissao_politica_unidade',
    );
    if (hasPolitica) {
      const hasConvFlag = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'comercial_comissao_politica_unidade'
          AND column_name = 'considerarConvenios'
        LIMIT 1
      `);
      if (!hasConvFlag?.length) {
        await queryRunner.query(`
          ALTER TABLE comercial_comissao_politica_unidade
          ADD COLUMN "considerarConvenios" boolean NOT NULL DEFAULT false
        `);
      }
      const hasTaxaFlag = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'comercial_comissao_politica_unidade'
          AND column_name = 'considerarTaxas'
        LIMIT 1
      `);
      if (!hasTaxaFlag?.length) {
        await queryRunner.query(`
          ALTER TABLE comercial_comissao_politica_unidade
          ADD COLUMN "considerarTaxas" boolean NOT NULL DEFAULT false
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasPolitica = await queryRunner.hasTable(
      'comercial_comissao_politica_unidade',
    );
    if (hasPolitica) {
      for (const col of ['considerarTaxas', 'considerarConvenios']) {
        const has = await queryRunner.query(`
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'comercial_comissao_politica_unidade'
            AND column_name = '${col}'
          LIMIT 1
        `);
        if (has?.length) {
          await queryRunner.query(`
            ALTER TABLE comercial_comissao_politica_unidade
            DROP COLUMN "${col}"
          `);
        }
      }
    }

    const hasConv = await queryRunner.hasTable('caixa_pagamento_convenio_item');
    if (hasConv) {
      await queryRunner.query(`DROP TABLE caixa_pagamento_convenio_item`);
    }
  }
}
