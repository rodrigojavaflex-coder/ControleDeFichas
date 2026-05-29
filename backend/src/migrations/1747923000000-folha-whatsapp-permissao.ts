import { MigrationInterface, QueryRunner } from 'typeorm';

const FECHAR = 'folha-fechamento:fechar';
const ENVIAR_RECIBO_WHATSAPP = 'folha-lancamento:enviar-recibo-whatsapp';

export class FolhaWhatsappPermissao1747923000000 implements MigrationInterface {
  name = 'FolhaWhatsappPermissao1747923000000';

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
      if (list.includes(ENVIAR_RECIBO_WHATSAPP)) continue;
      list.push(ENVIAR_RECIBO_WHATSAPP);
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
      const next = list.filter((p) => p !== ENVIAR_RECIBO_WHATSAPP);
      if (next.length === list.length) continue;
      await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
        next.join(','),
        row.id,
      ]);
    }
  }
}
