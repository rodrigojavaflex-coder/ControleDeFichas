import { MigrationInterface, QueryRunner } from 'typeorm';
import { Permission } from '../common/enums/permission.enum';

const ADMIN_FULL = 'admin:full';

/** Todas as permissões vigentes no enum (sem `admin:full`). */
const TODAS_PERMISSOES = Object.values(Permission);

/**
 * Remove `admin:full` dos perfis e expande permissões explícitas
 * para quem dependia apenas desse bypass.
 */
export class RemoveAdminFullPerfil1749200000000 implements MigrationInterface {
  name = 'RemoveAdminFullPerfil1749200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; permissoes: string }[] = await queryRunner.query(
      `SELECT id, permissoes FROM perfil WHERE permissoes IS NOT NULL AND permissoes != ''`,
    );
    for (const row of rows) {
      const list = row.permissoes
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (!list.includes(ADMIN_FULL)) {
        continue;
      }
      const next = Array.from(
        new Set([
          ...list.filter((p) => p !== ADMIN_FULL),
          ...TODAS_PERMISSOES,
        ]),
      );
      await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
        next.join(','),
        row.id,
      ]);
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // `admin:full` removido do catálogo — não restaurar automaticamente.
  }
}
