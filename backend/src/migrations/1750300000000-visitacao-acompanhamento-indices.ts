import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices para GET /visitacao/acompanhamento: caixa por data, prescritor, nrorc e painel CRM.
 */
export class VisitacaoAcompanhamentoIndices1750300000000 implements MigrationInterface {
  name = 'VisitacaoAcompanhamentoIndices1750300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('caixa_itens_erp')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_caixa_itens_erp_req_data
        ON caixa_itens_erp (data_operacao)
        WHERE tipo_item = 'REQUISICAO' AND numero_requisicao IS NOT NULL
      `);
    }

    if (await queryRunner.hasTable('caixa_requisicoes_pagas')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_caixa_req_pagas_unidade_req_cupom
        ON caixa_requisicoes_pagas (unidade, numero_requisicao, numero_cupom)
      `);
    }

    if (await queryRunner.hasTable('orcamentos')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_orcamentos_nrorc
        ON orcamentos (nrorc)
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_orcamentos_rejeitado_data
        ON orcamentos (status, "dataOrcamento")
        WHERE status = 'REJEITADO'
      `);
    }

    if (await queryRunner.hasTable('painel_medicos_representantes')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_painel_unidade_crm_uf
        ON painel_medicos_representantes (unidade, "crmMedico", "ufCrmMedico")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_painel_unidade_crm_uf`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orcamentos_rejeitado_data`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orcamentos_nrorc`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_caixa_req_pagas_unidade_req_cupom`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_caixa_itens_erp_req_data`);
  }
}
