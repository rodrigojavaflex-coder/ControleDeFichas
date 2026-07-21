import { MigrationInterface, QueryRunner } from 'typeorm';

const REMOVIDAS = [
  'reports:view',
  'reports:export',
  'system:config',
  'system:logs',
];

export class RemovePermissoesOrfasPerfil1749100000000
  implements MigrationInterface
{
  name = 'RemovePermissoesOrfasPerfil1749100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; permissoes: string }[] = await queryRunner.query(
      `SELECT id, permissoes FROM perfil WHERE permissoes IS NOT NULL AND permissoes != ''`,
    );
    for (const row of rows) {
      const list = row.permissoes
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const next = list.filter((p) => !REMOVIDAS.includes(p));
      if (next.length === list.length) continue;
      await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
        next.join(','),
        row.id,
      ]);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Permissões órfas removidas do enum — não restaurar automaticamente.
  }
}
