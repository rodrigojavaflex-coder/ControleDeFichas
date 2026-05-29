import { MigrationInterface, QueryRunner } from 'typeorm';

const ENVIAR_RECIBO_LANCAMENTO = 'folha-lancamento:enviar-recibo-whatsapp';
const ENVIAR_RECIBOS_CONTROLE = 'folha-fechamento:enviar-recibos-whatsapp';

/**
 * Separa permissão de envio em massa (Controle) da permissão individual (Lançamento).
 * Perfis que já tinham envio individual recebem também a permissão de massa (retrocompatível).
 */
export class FolhaWhatsappPermissaoControle1747924000000 implements MigrationInterface {
  name = 'FolhaWhatsappPermissaoControle1747924000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; permissoes: string }[] = await queryRunner.query(
      `SELECT id, permissoes FROM perfil WHERE permissoes IS NOT NULL AND permissoes != ''`,
    );
    for (const row of rows) {
      const list = row.permissoes
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (!list.includes(ENVIAR_RECIBO_LANCAMENTO)) continue;
      if (list.includes(ENVIAR_RECIBOS_CONTROLE)) continue;
      list.push(ENVIAR_RECIBOS_CONTROLE);
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
      const next = list.filter((p) => p !== ENVIAR_RECIBOS_CONTROLE);
      if (next.length === list.length) continue;
      await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
        next.join(','),
        row.id,
      ]);
    }
  }
}
