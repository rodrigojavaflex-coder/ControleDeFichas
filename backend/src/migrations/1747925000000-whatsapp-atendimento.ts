import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class WhatsappAtendimento1747925000000 implements MigrationInterface {
  name = 'WhatsappAtendimento1747925000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_conversa',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'telefoneOrigem',
            type: 'varchar',
            length: '20',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'telefoneMascarado',
            type: 'varchar',
            length: '24',
            isNullable: false,
          },
          { name: 'funcionarioId', type: 'uuid', isNullable: true },
          { name: 'nomePerfil', type: 'varchar', length: '200', isNullable: true },
          { name: 'naoLida', type: 'boolean', default: true },
          { name: 'ultimaMensagemEm', type: 'timestamptz', isNullable: true },
          {
            name: 'criadoEm',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP(6)',
          },
          {
            name: 'atualizadoEm',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'whatsapp_mensagem',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'conversaId', type: 'uuid', isNullable: false },
          {
            name: 'wamid',
            type: 'varchar',
            length: '128',
            isNullable: true,
            isUnique: true,
          },
          { name: 'direcao', type: 'varchar', length: '16', isNullable: false },
          {
            name: 'tipo',
            type: 'varchar',
            length: '32',
            default: "'text'",
          },
          { name: 'conteudoTexto', type: 'text', isNullable: true },
          { name: 'status', type: 'varchar', length: '32', isNullable: true },
          { name: 'usuarioRespostaId', type: 'uuid', isNullable: true },
          { name: 'folhaCapaId', type: 'uuid', isNullable: true },
          { name: 'erroCodigo', type: 'int', isNullable: true },
          { name: 'erroMensagem', type: 'text', isNullable: true },
          { name: 'metaTimestamp', type: 'timestamptz', isNullable: false },
          {
            name: 'criadoEm',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP(6)',
          },
          {
            name: 'atualizadoEm',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'whatsapp_conversa',
      new TableForeignKey({
        columnNames: ['funcionarioId'],
        referencedTableName: 'funcionarios',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'whatsapp_mensagem',
      new TableForeignKey({
        columnNames: ['conversaId'],
        referencedTableName: 'whatsapp_conversa',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'whatsapp_mensagem',
      new TableForeignKey({
        columnNames: ['usuarioRespostaId'],
        referencedTableName: 'usuarios',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'whatsapp_mensagem',
      new TableForeignKey({
        columnNames: ['folhaCapaId'],
        referencedTableName: 'folha_capa',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createIndex(
      'whatsapp_conversa',
      new TableIndex({
        name: 'IDX_whatsapp_conversa_funcionario',
        columnNames: ['funcionarioId'],
      }),
    );

    await queryRunner.createIndex(
      'whatsapp_conversa',
      new TableIndex({
        name: 'IDX_whatsapp_conversa_ultima_mensagem',
        columnNames: ['ultimaMensagemEm'],
      }),
    );

    await queryRunner.createIndex(
      'whatsapp_mensagem',
      new TableIndex({
        name: 'IDX_whatsapp_mensagem_conversa',
        columnNames: ['conversaId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('whatsapp_mensagem', true);
    await queryRunner.dropTable('whatsapp_conversa', true);
  }
}
