import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Índices extras da busca de auditoria: ORDER BY data, colunas curtas e nome do usuário.
 * Expressão translate(lower(...)) igual à do AuditoriaService.
 */
export class AuditoriaSearchIndexes1750600000000 implements MigrationInterface {
  name = 'AuditoriaSearchIndexes1750600000000';

  private static readonly ACCENT_FROM = 'áàâãäéèêëíìîïóòôõöúùûüçñý';
  private static readonly ACCENT_TO = 'aaaaaeeeeiiiiooooouuuucny';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    const from = AuditoriaSearchIndexes1750600000000.ACCENT_FROM;
    const to = AuditoriaSearchIndexes1750600000000.ACCENT_TO;

    if (await queryRunner.hasTable('auditoria')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_auditoria_criado_em
        ON auditoria ("criadoEm" DESC)
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_id
        ON auditoria ("usuarioId")
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_auditoria_endereco_ip_trgm
        ON auditoria
        USING gin (
          translate(lower(COALESCE("enderecoIp", '')), '${from}', '${to}')
          gin_trgm_ops
        )
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_auditoria_entidade_id_trgm
        ON auditoria
        USING gin (
          translate(lower(COALESCE("entidadeId", '')), '${from}', '${to}')
          gin_trgm_ops
        )
      `);
    }

    if (await queryRunner.hasTable('usuarios')) {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS idx_usuarios_nome_trgm
        ON usuarios
        USING gin (
          translate(lower(COALESCE(nome, '')), '${from}', '${to}')
          gin_trgm_ops
        )
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_usuarios_nome_trgm`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_auditoria_entidade_id_trgm`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_auditoria_endereco_ip_trgm`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS idx_auditoria_usuario_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_auditoria_criado_em`);
  }
}
