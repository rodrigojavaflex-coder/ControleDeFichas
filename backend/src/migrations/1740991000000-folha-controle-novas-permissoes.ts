import { MigrationInterface, QueryRunner } from 'typeorm';

const FECHAR = 'folha-fechamento:fechar';
const REGISTRAR_ABERTURA = 'folha-fechamento:registrar-abertura';
const REABRIR = 'folha-fechamento:reabrir';

/**
 * Perfis que já tinham `folha-fechamento:fechar` ganham registrar-abertura e reabrir
 * (substitui o uso único dessa permissão para as três operações até o admin afinar perfis).
 */
export class FolhaControleNovasPermissoes1740991000000
  implements MigrationInterface
{
  name = 'FolhaControleNovasPermissoes1740991000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; permissoes: string }[] = await queryRunner.query(
      `SELECT id, permissoes FROM perfil WHERE permissoes IS NOT NULL AND permissoes != ''`,
    );
    for (const row of rows) {
      const list = row.permissoes
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (!list.includes(FECHAR)) continue;
      let changed = false;
      if (!list.includes(REGISTRAR_ABERTURA)) {
        list.push(REGISTRAR_ABERTURA);
        changed = true;
      }
      if (!list.includes(REABRIR)) {
        list.push(REABRIR);
        changed = true;
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
      const next = list.filter((p: string) => p !== REGISTRAR_ABERTURA && p !== REABRIR);
      if (next.length !== list.length) {
        await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
          next.join(','),
          row.id,
        ]);
      }
    }
  }
}
