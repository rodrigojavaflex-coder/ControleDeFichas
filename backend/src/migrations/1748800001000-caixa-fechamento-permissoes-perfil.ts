import { MigrationInterface, QueryRunner } from 'typeorm';

const ADMIN = 'admin:full';
const PERM_FECHAR = 'venda:fechar-caixa';
const PERM_REABRIR = 'venda:reabrir-caixa';

export class CaixaFechamentoPermissoesPerfil1748800001000
  implements MigrationInterface
{
  name = 'CaixaFechamentoPermissoesPerfil1748800001000';

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
      for (const perm of [PERM_FECHAR, PERM_REABRIR]) {
        if (!list.includes(perm)) {
          list.push(perm);
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
    const rows: { id: string; permissoes: string }[] = await queryRunner.query(
      `SELECT id, permissoes FROM perfil WHERE permissoes IS NOT NULL AND permissoes != ''`,
    );
    for (const row of rows) {
      const list = row.permissoes
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const next = list.filter((p) => p !== PERM_FECHAR && p !== PERM_REABRIR);
      if (next.length === list.length) continue;
      await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
        next.join(','),
        row.id,
      ]);
    }
  }
}
