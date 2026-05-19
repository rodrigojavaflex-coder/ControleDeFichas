import { MigrationInterface, QueryRunner } from 'typeorm';

const VERBA_AUDIT = 'folha-verba:audit';
const ADMIN = 'admin:full';
const CARGO_AUDIT = 'folha-cargo:audit';
const SETOR_AUDIT = 'folha-setor:audit';
const ADMIN_VERBA: string[] = [
  'folha-verba:create',
  'folha-verba:read',
  'folha-verba:update',
  'folha-verba:delete',
  VERBA_AUDIT,
];

/**
 * Concede `folha-verba:audit` a perfis com auditoria de cargo/setor ou `admin:full`.
 */
export class FolhaVerbaAuditPermissaoPerfil1743410000000
  implements MigrationInterface
{
  name = 'FolhaVerbaAuditPermissaoPerfil1743410000000';

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
      const hasFolhaCadastroAudit =
        list.includes(CARGO_AUDIT) || list.includes(SETOR_AUDIT);
      if (hasFolhaCadastroAudit && !list.includes(VERBA_AUDIT)) {
        list.push(VERBA_AUDIT);
        changed = true;
      }
      if (list.includes(ADMIN)) {
        for (const p of ADMIN_VERBA) {
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
    for (const row of rows) {
      const list = row.permissoes
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (!list.includes(VERBA_AUDIT)) continue;
      const next = list.filter((p) => p !== VERBA_AUDIT);
      await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
        next.join(','),
        row.id,
      ]);
    }
  }
}
