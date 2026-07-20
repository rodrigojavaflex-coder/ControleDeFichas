import { MigrationInterface, QueryRunner } from 'typeorm';

const READ = 'producao-config:read';
const UPDATE = 'producao-config:update';
const ADMIN = 'admin:full';
const FOLHA_FN_READ = 'folha-funcionario:read';

/** Concede config produção a perfis admin e a quem já lê funcionários da folha. */
export class ProducaoConfigPermissoesPerfil1749000002000
  implements MigrationInterface
{
  name = 'ProducaoConfigPermissoesPerfil1749000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; permissoes: string }[] = await queryRunner.query(
      `SELECT id, permissoes FROM perfil WHERE permissoes IS NOT NULL AND permissoes != ''`,
    );
    for (const row of rows) {
      const list = row.permissoes
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      let changed = false;
      const grant =
        list.includes(ADMIN) || list.includes(FOLHA_FN_READ);
      if (grant) {
        if (!list.includes(READ)) {
          list.push(READ);
          changed = true;
        }
        if (list.includes(ADMIN) && !list.includes(UPDATE)) {
          list.push(UPDATE);
          changed = true;
        }
      }
      if (changed) {
        await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
          list.join(','),
          row.id,
        ]);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; permissoes: string }[] = await queryRunner.query(
      `SELECT id, permissoes FROM perfil WHERE permissoes IS NOT NULL AND permissoes != ''`,
    );
    const toStrip = new Set<string>([READ, UPDATE]);
    for (const row of rows) {
      const list = row.permissoes
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const next = list.filter((p) => !toStrip.has(p));
      if (next.length !== list.length) {
        await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
          next.join(','),
          row.id,
        ]);
      }
    }
  }
}
