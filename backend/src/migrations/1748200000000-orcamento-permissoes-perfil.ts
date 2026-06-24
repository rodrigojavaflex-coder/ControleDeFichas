import { MigrationInterface, QueryRunner } from 'typeorm';

const ADMIN = 'admin:full';

const ORCAMENTO_PERMISSOES: string[] = [
  'orcamento-motivo:create',
  'orcamento-motivo:read',
  'orcamento-motivo:update',
  'orcamento-motivo:delete',
  'orcamento-rejeitado:read',
  'orcamento-rejeitado:update',
];

/**
 * Concede permissões de orçamentos (motivos + rejeitados) a perfis com admin:full.
 */
export class OrcamentoPermissoesPerfil1748200000000
  implements MigrationInterface
{
  name = 'OrcamentoPermissoesPerfil1748200000000';

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

      let changed = false;
      for (const p of ORCAMENTO_PERMISSOES) {
        if (!list.includes(p)) {
          list.push(p);
          changed = true;
        }
      }
      if (!changed) continue;
      await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
        list.join(','),
        row.id,
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const strip = new Set(ORCAMENTO_PERMISSOES);
    const rows: { id: string; permissoes: string }[] = await queryRunner.query(
      `SELECT id, permissoes FROM perfil WHERE permissoes IS NOT NULL AND permissoes != ''`,
    );
    for (const row of rows) {
      const list = row.permissoes
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const next = list.filter((p) => !strip.has(p));
      if (next.length === list.length) continue;
      await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
        next.join(','),
        row.id,
      ]);
    }
  }
}
