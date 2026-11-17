import { MigrationInterface, QueryRunner } from 'typeorm';

/** Status Resolvida/Reaberta e histórico de cada mudança da pendência. */
export class SolicitacaoHistorico1750960000000 implements MigrationInterface {
  name = 'SolicitacaoHistorico1750960000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE solicitacoes DROP CONSTRAINT IF EXISTS ck_solicitacoes_status
    `);
    await queryRunner.query(`
      ALTER TABLE solicitacoes
      ADD CONSTRAINT ck_solicitacoes_status
      CHECK (status IN ('ABERTA', 'RESOLVIDA', 'CONCLUIDA', 'REABERTA'))
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS solicitacao_historicos (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "solicitacaoId" uuid NOT NULL,
        status varchar(20) NOT NULL,
        descricao text NOT NULL,
        "usuarioId" uuid NULL,
        "criadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_solicitacao_historicos_solicitacao
          FOREIGN KEY ("solicitacaoId") REFERENCES solicitacoes(id) ON DELETE CASCADE,
        CONSTRAINT fk_solicitacao_historicos_usuario
          FOREIGN KEY ("usuarioId") REFERENCES usuarios(id) ON DELETE SET NULL,
        CONSTRAINT ck_solicitacao_historicos_status
          CHECK (status IN ('ABERTA', 'RESOLVIDA', 'CONCLUIDA', 'REABERTA'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_solicitacao_historicos_solicitacao
      ON solicitacao_historicos ("solicitacaoId", "criadoEm")
    `);
    await queryRunner.query(`
      INSERT INTO solicitacao_historicos (
        id, "solicitacaoId", status, descricao, "usuarioId", "criadoEm", "atualizadoEm"
      )
      SELECT
        uuid_generate_v4(),
        s.id,
        s.status,
        s.texto,
        s."visitadorId",
        s."criadoEm",
        s."criadoEm"
      FROM solicitacoes s
      WHERE NOT EXISTS (
        SELECT 1 FROM solicitacao_historicos h WHERE h."solicitacaoId" = s.id
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_solicitacao_historicos_solicitacao`);
    await queryRunner.query(`DROP TABLE IF EXISTS solicitacao_historicos`);
    await queryRunner.query(`
      UPDATE solicitacoes
      SET status = 'ABERTA'
      WHERE status IN ('RESOLVIDA', 'REABERTA')
    `);
    await queryRunner.query(`
      ALTER TABLE solicitacoes DROP CONSTRAINT IF EXISTS ck_solicitacoes_status
    `);
    await queryRunner.query(`
      ALTER TABLE solicitacoes
      ADD CONSTRAINT ck_solicitacoes_status
      CHECK (status IN ('ABERTA', 'CONCLUIDA'))
    `);
  }
}
