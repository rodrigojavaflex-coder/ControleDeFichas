import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices para acelerar GET /visitacao/acompanhamento (ao vivo e retrato)
 * e o recorte por unidade+data do caixa/orçamento.
 * Fora de transação para permitir CREATE INDEX CONCURRENTLY nas tabelas grandes.
 */
export class VisitacaoAcompanhamentoPerf1750570000000
  implements MigrationInterface
{
  name = 'VisitacaoAcompanhamentoPerf1750570000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('caixa_itens_erp')) {
      await queryRunner.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_caixa_itens_erp_unidade_req_data
        ON caixa_itens_erp (unidade, data_operacao)
        WHERE tipo_item = 'REQUISICAO' AND numero_requisicao IS NOT NULL
      `);
    }

    if (await queryRunner.hasTable('caixa_requisicoes_pagas')) {
      await queryRunner.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_caixa_req_pagas_data
        ON caixa_requisicoes_pagas (data_pagamento)
      `);
    }

    if (await queryRunner.hasTable('orcamentos')) {
      await queryRunner.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orcamentos_rejeitado_unidade_data
        ON orcamentos (unidade, "dataOrcamento")
        WHERE status = 'REJEITADO'
      `);
    }

    if (await queryRunner.hasTable('visitacao_fechamento_medico')) {
      await queryRunner.query(`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visitacao_fech_medico_fech_recebido
        ON visitacao_fechamento_medico (fechamento_id, recebido_loja DESC)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_visitacao_fech_medico_fech_recebido`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_orcamentos_rejeitado_unidade_data`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_caixa_req_pagas_data`,
    );
    await queryRunner.query(
      `DROP INDEX CONCURRENTLY IF EXISTS idx_caixa_itens_erp_unidade_req_data`,
    );
  }
}
