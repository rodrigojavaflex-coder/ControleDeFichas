import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableColumn,
} from 'typeorm';

export class CreateOrcamentosAndSyncConfig1748000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const configTable = await queryRunner.getTable('sincronizacao_config');
    if (configTable && !configTable.findColumnByName('ultimaModificacaoOrcamento')) {
      await queryRunner.addColumn(
        'sincronizacao_config',
        new TableColumn({
          name: 'ultimaModificacaoOrcamento',
          type: 'timestamp',
          isNullable: true,
        }),
      );
      console.log('✅ Coluna ultimaModificacaoOrcamento adicionada em sincronizacao_config');
    }

    const orcamentosTable = await queryRunner.getTable('orcamentos');
    if (orcamentosTable) {
      console.log('⚠️  Tabela orcamentos já existe');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'orcamentos',
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
            name: 'cdfil',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'nrorc',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'serieo',
            type: 'varchar',
            length: '10',
            isNullable: false,
          },
          {
            name: 'nrOrcamento',
            type: 'varchar',
            length: '30',
            isNullable: false,
          },
          {
            name: 'dataOrcamento',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'precoVenda',
            type: 'numeric',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'precoCobrado',
            type: 'numeric',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'descontoFormula',
            type: 'numeric',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'codigoCliente',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'nomeCliente',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'codigoVendedor',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'nomeVendedor',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'ultimaModificacao',
            type: 'timestamp',
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
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'orcamentos',
      new TableIndex({
        name: 'uq_orcamentos_unidade_nrorc_serieo',
        columnNames: ['unidade', 'nrorc', 'serieo'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'orcamentos',
      new TableIndex({
        name: 'idx_orcamentos_unidade_data',
        columnNames: ['unidade', 'dataOrcamento'],
      }),
    );

    await queryRunner.createIndex(
      'orcamentos',
      new TableIndex({
        name: 'idx_orcamentos_status',
        columnNames: ['status'],
      }),
    );

    await queryRunner.createIndex(
      'orcamentos',
      new TableIndex({
        name: 'idx_orcamentos_ultima_modificacao',
        columnNames: ['ultimaModificacao'],
      }),
    );

    console.log('✅ Tabela orcamentos criada');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const orcamentosTable = await queryRunner.getTable('orcamentos');
    if (orcamentosTable) {
      await queryRunner.dropTable('orcamentos');
      console.log('✅ Tabela orcamentos removida');
    }

    const configTable = await queryRunner.getTable('sincronizacao_config');
    if (
      configTable &&
      configTable.findColumnByName('ultimaModificacaoOrcamento')
    ) {
      await queryRunner.dropColumn(
        'sincronizacao_config',
        'ultimaModificacaoOrcamento',
      );
      console.log('✅ Coluna ultimaModificacaoOrcamento removida');
    }
  }
}
