import { MigrationInterface, QueryRunner } from 'typeorm';

const ADMIN = 'admin:full';
const PERMISSAO_DASHBOARD = 'orcamento-dashboard:read';

/**
 * Concede orcamento-dashboard:read a perfis com admin:full.
 */
export class OrcamentoDashboardPermissaoPerfil1748500000000
  implements MigrationInterface
{
  name = 'OrcamentoDashboardPermissaoPerfil1748500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; permissoes: string }[] = await queryRunner.query(
      `SELECT id, permissoes FROM perfil WHERE permissoes IS NOT NULL AND permissoes != ''`,
    );
    for (const row of rows) {
      const list = row.permissoes
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (!list.includes(ADMIN)) continue;
      if (list.includes(PERMISSAO_DASHBOARD)) continue;
      list.push(PERMISSAO_DASHBOARD);
      await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
        list.join(','),
        row.id,
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; permissoes: string }[] = await queryRunner.query(
      `SELECT id, permissoes FROM perfil WHERE permissoes IS NOT NULL AND permissoes != ''`,
    );
    for (const row of rows) {
      const list = row.permissoes
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const next = list.filter((p) => p !== PERMISSAO_DASHBOARD);
      if (next.length === list.length) continue;
      await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
        next.join(','),
        row.id,
      ]);
    }
  }
}
