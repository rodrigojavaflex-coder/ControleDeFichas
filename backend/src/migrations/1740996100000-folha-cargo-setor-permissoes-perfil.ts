import { MigrationInterface, QueryRunner } from 'typeorm';

const READ_CARGO = 'folha-cargo:read';
const READ_SETOR = 'folha-setor:read';
const FN_KEYS = [
  'folha-funcionario:read',
  'folha-funcionario:create',
  'folha-funcionario:update',
] as const;
const ADMIN = 'admin:full';
const ADMIN_CARGO_SETOR: string[] = [
  'folha-cargo:create',
  READ_CARGO,
  'folha-cargo:update',
  'folha-cargo:delete',
  'folha-cargo:audit',
  'folha-setor:create',
  READ_SETOR,
  'folha-setor:update',
  'folha-setor:delete',
  'folha-setor:audit',
];

/**
 * Inclui leitura de cargos/setores em perfis que já editam funcionários da folha;
 * concede pacote cargo+setor a perfis com `admin:full`.
 */
export class FolhaCargoSetorPermissoesPerfil1740996100000
  implements MigrationInterface
{
  name = 'FolhaCargoSetorPermissoesPerfil1740996100000';

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
      const hasFn = FN_KEYS.some((k) => list.includes(k));
      if (hasFn) {
        if (!list.includes(READ_CARGO)) {
          list.push(READ_CARGO);
          changed = true;
        }
        if (!list.includes(READ_SETOR)) {
          list.push(READ_SETOR);
          changed = true;
        }
      }
      if (list.includes(ADMIN)) {
        for (const p of ADMIN_CARGO_SETOR) {
          if (!list.includes(p)) {
            list.push(p);
            changed = true;
          }
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
    const toStrip = new Set<string>([
      READ_CARGO,
      READ_SETOR,
      ...ADMIN_CARGO_SETOR,
    ]);
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
