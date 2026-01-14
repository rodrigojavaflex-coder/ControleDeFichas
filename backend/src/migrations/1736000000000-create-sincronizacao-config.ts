import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateSincronizacaoConfig1736000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('sincronizacao_config');
    if (table) {
      console.log('⚠️  Tabela sincronizacao_config já existe');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'sincronizacao_config',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'agente',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'ultimaDataCliente',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'ultimaDataPrescritor',
            type: 'date',
            isNullable: true,
          },
          {
            name: 'intervaloMinutos',
            type: 'integer',
            default: 60,
          },
          {
            name: 'ativo',
            type: 'boolean',
            default: true,
          },
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

    // Criar índice único para agente
    await queryRunner.createIndex(
      'sincronizacao_config',
      new TableIndex({
        name: 'IDX_sincronizacao_config_agente',
        columnNames: ['agente'],
        isUnique: true,
      }),
    );

    console.log('✅ Tabela sincronizacao_config criada');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('sincronizacao_config');
    if (table) {
      await queryRunner.dropTable('sincronizacao_config');
      console.log('✅ Tabela sincronizacao_config removida');
    }
  }
}
