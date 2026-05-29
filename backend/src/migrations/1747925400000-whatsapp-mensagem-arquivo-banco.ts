import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class WhatsappMensagemArquivoBanco1747925400000 implements MigrationInterface {
  name = 'WhatsappMensagemArquivoBanco1747925400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('whatsapp_mensagem', [
      new TableColumn({
        name: 'arquivoConteudo',
        type: 'bytea',
        isNullable: true,
      }),
      new TableColumn({
        name: 'arquivoExpiraEm',
        type: 'timestamptz',
        isNullable: true,
      }),
      new TableColumn({
        name: 'temArquivo',
        type: 'boolean',
        default: false,
      }),
    ]);

    await queryRunner.query(`
      UPDATE whatsapp_mensagem
      SET "temArquivo" = true
      WHERE "arquivoPath" IS NOT NULL AND TRIM("arquivoPath") <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('whatsapp_mensagem', 'temArquivo');
    await queryRunner.dropColumn('whatsapp_mensagem', 'arquivoExpiraEm');
    await queryRunner.dropColumn('whatsapp_mensagem', 'arquivoConteudo');
  }
}
