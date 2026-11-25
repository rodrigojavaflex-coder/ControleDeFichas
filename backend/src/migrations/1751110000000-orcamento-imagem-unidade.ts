import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class OrcamentoImagemUnidade1751110000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existente = await queryRunner.getTable('orcamento_imagem_unidade');
    if (existente) {
      console.log('⚠️  Tabela orcamento_imagem_unidade já existe');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'orcamento_imagem_unidade',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'unidade',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'tipo',
            type: 'varchar',
            length: '10',
            isNullable: false,
          },
          {
            name: 'imagem',
            type: 'bytea',
            isNullable: false,
          },
          {
            name: 'mime',
            type: 'varchar',
            length: '100',
            isNullable: false,
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
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'orcamento_imagem_unidade',
      new TableIndex({
        name: 'uq_orcamento_imagem_unidade_tipo',
        columnNames: ['unidade', 'tipo'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'orcamento_imagem_unidade',
      new TableIndex({
        name: 'idx_orcamento_imagem_unidade',
        columnNames: ['unidade'],
      }),
    );
    console.log('✅ Tabela orcamento_imagem_unidade criada');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const existente = await queryRunner.getTable('orcamento_imagem_unidade');
    if (!existente) {
      return;
    }
    await queryRunner.dropTable('orcamento_imagem_unidade');
    console.log('✅ Tabela orcamento_imagem_unidade removida');
  }
}
