import { MigrationInterface, QueryRunner } from 'typeorm';

/** Mesma lógica de canonizarTelefoneWhatsappBR (migration autônoma). */
function canonizarTelefoneWhatsappBR(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;

  let e164: string | null = null;
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    e164 = digits;
  } else if (digits.length === 10 || digits.length === 11) {
    e164 = `55${digits}`;
  } else if (digits.startsWith('55')) {
    e164 = digits;
  }

  if (!e164?.startsWith('55')) {
    return e164;
  }
  if (e164.length === 13) {
    return e164;
  }
  if (e164.length === 12) {
    const local = e164.slice(4);
    const primeiro = local.charAt(0);
    if (local.length === 8 && primeiro >= '6' && primeiro <= '9') {
      return `${e164.slice(0, 4)}9${local}`;
    }
  }
  return e164;
}

function mascararTelefone(telefone: string): string {
  const digits = telefone.replace(/\D/g, '');
  if (digits.length <= 6) return '***';
  return `${digits.slice(0, 4)}****${digits.slice(-4)}`;
}

type ConversaRow = {
  id: string;
  telefoneOrigem: string;
  funcionarioId: string | null;
  nomePerfil: string | null;
  naoLida: boolean;
  ultimaMensagemEm: Date | null;
  criadoEm: Date;
};

export class WhatsappConversaTelefoneCanon1747925200000
  implements MigrationInterface
{
  name = 'WhatsappConversaTelefoneCanon1747925200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: ConversaRow[] = await queryRunner.query(
      `SELECT id, "telefoneOrigem", "funcionarioId", "nomePerfil", "naoLida", "ultimaMensagemEm", "criadoEm"
       FROM whatsapp_conversa`,
    );

    const grupos = new Map<string, ConversaRow[]>();
    for (const row of rows) {
      const canon =
        canonizarTelefoneWhatsappBR(row.telefoneOrigem) ?? row.telefoneOrigem;
      const list = grupos.get(canon) ?? [];
      list.push(row);
      grupos.set(canon, list);
    }

    for (const [canon, list] of grupos) {
      if (list.length === 0) continue;

      const ordenadas = [...list].sort((a, b) => {
        if (a.funcionarioId && !b.funcionarioId) return -1;
        if (!a.funcionarioId && b.funcionarioId) return 1;
        return new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime();
      });

      const principal = ordenadas[0];
      const duplicatas = ordenadas.slice(1);

      for (const dup of duplicatas) {
        await queryRunner.query(
          `UPDATE whatsapp_mensagem SET "conversaId" = $1 WHERE "conversaId" = $2`,
          [principal.id, dup.id],
        );
        await queryRunner.query(`DELETE FROM whatsapp_conversa WHERE id = $1`, [
          dup.id,
        ]);
      }

      const funcionarioId =
        ordenadas.find((c) => c.funcionarioId)?.funcionarioId ??
        principal.funcionarioId;
      const nomePerfil =
        ordenadas.find((c) => c.nomePerfil?.trim())?.nomePerfil ??
        principal.nomePerfil;
      const naoLida = ordenadas.some((c) => c.naoLida);
      const ultima = ordenadas.reduce<Date | null>((max, c) => {
        if (!c.ultimaMensagemEm) return max;
        const d = new Date(c.ultimaMensagemEm);
        return !max || d > max ? d : max;
      }, null);

      await queryRunner.query(
        `UPDATE whatsapp_conversa
         SET "telefoneOrigem" = $1,
             "telefoneMascarado" = $2,
             "funcionarioId" = $3,
             "nomePerfil" = $4,
             "naoLida" = $5,
             "ultimaMensagemEm" = $6
         WHERE id = $7`,
        [
          canon,
          mascararTelefone(canon),
          funcionarioId,
          nomePerfil,
          naoLida,
          ultima,
          principal.id,
        ],
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Mesclagem de dados não reversível de forma segura.
  }
}
