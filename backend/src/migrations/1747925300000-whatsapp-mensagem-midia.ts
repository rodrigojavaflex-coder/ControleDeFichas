import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class WhatsappMensagemMidia1747925300000 implements MigrationInterface {
  name = 'WhatsappMensagemMidia1747925300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('whatsapp_mensagem', [
      new TableColumn({
        name: 'nomeArquivo',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
      new TableColumn({
        name: 'mimeType',
        type: 'varchar',
        length: '128',
        isNullable: true,
      }),
      new TableColumn({
        name: 'metaMediaId',
        type: 'varchar',
        length: '128',
        isNullable: true,
      }),
      new TableColumn({
        name: 'arquivoPath',
        type: 'varchar',
        length: '512',
        isNullable: true,
      }),
      new TableColumn({
        name: 'legenda',
        type: 'varchar',
        length: '1024',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('whatsapp_mensagem', 'legenda');
    await queryRunner.dropColumn('whatsapp_mensagem', 'arquivoPath');
    await queryRunner.dropColumn('whatsapp_mensagem', 'metaMediaId');
    await queryRunner.dropColumn('whatsapp_mensagem', 'mimeType');
    await queryRunner.dropColumn('whatsapp_mensagem', 'nomeArquivo');
  }
}
