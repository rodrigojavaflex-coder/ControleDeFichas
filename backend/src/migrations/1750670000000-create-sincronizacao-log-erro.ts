import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Histórico consultável de warn/error da sincronização (UI Configuração).
 */
export class CreateSincronizacaoLogErro1750670000000
  implements MigrationInterface
{
  name = 'CreateSincronizacaoLogErro1750670000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('sincronizacao_log_erro');
    if (exists) {
      return;
    }

    await queryRunner.query(`
      CREATE TABLE sincronizacao_log_erro (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "criadoEm" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        "atualizadoEm" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        agente varchar(50) NOT NULL,
        etapa varchar(80) NOT NULL,
        nivel varchar(10) NOT NULL,
        mensagem text NOT NULL,
        detalhe text NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_sincronizacao_log_erro_agente_criado
      ON sincronizacao_log_erro (agente, "criadoEm" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_sincronizacao_log_erro_criado
      ON sincronizacao_log_erro ("criadoEm" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('sincronizacao_log_erro');
    if (!exists) {
      return;
    }
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_sincronizacao_log_erro_criado`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_sincronizacao_log_erro_agente_criado`,
    );
    await queryRunner.query(`DROP TABLE sincronizacao_log_erro`);
  }
}
