import { MigrationInterface, QueryRunner } from 'typeorm';

const ENVIAR_RECIBO = 'folha-lancamento:enviar-recibo-whatsapp';
const READ = 'folha-whatsapp:read';
const REPLY = 'folha-whatsapp:reply';

export class FolhaWhatsappAtendimentoPermissao1747925100000
  implements MigrationInterface
{
  name = 'FolhaWhatsappAtendimentoPermissao1747925100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; permissoes: string }[] = await queryRunner.query(
      `SELECT id, permissoes FROM perfil WHERE permissoes IS NOT NULL AND permissoes != ''`,
    );
    for (const row of rows) {
      const list = row.permissoes
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      if (!list.includes(ENVIAR_RECIBO)) continue;
      let alterou = false;
      if (!list.includes(READ)) {
        list.push(READ);
        alterou = true;
      }
      if (!list.includes(REPLY)) {
        list.push(REPLY);
        alterou = true;
      }
      if (!alterou) continue;
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
      const next = list.filter((p) => p !== READ && p !== REPLY);
      if (next.length === list.length) continue;
      await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
        next.join(','),
        row.id,
      ]);
    }
  }
}
