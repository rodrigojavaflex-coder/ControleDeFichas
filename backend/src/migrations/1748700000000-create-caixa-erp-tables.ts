import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateCaixaErpTables1748700000000 implements MigrationInterface {
  name = 'CreateCaixaErpTables1748700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const pagamentosExists = await queryRunner.hasTable('caixa_pagamentos_erp');
    if (pagamentosExists) {
      console.log('⚠️  Tabelas caixa ERP já existem');
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'caixa_pagamentos_erp',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'chave_erp',
            type: 'varchar',
            length: '80',
            isNullable: false,
          },
          {
            name: 'unidade',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'data_operacao',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'numero_cupom',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'codigo_terminal',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'id_operacao',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'forma_pagamento',
            type: 'varchar',
            length: '30',
            isNullable: false,
          },
          {
            name: 'valor_pago',
            type: 'numeric',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'valor_troco',
            type: 'numeric',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'valor_liquido',
            type: 'numeric',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'total_cupom_bruto',
            type: 'numeric',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'total_cupom_liquido',
            type: 'numeric',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'codigo_cliente',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'codigo_operador_caixa',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'nome_operador_caixa',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'importado_em',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'atualizado_em',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'caixa_pagamentos_erp',
      new TableIndex({
        name: 'uq_caixa_pagamentos_erp_chave',
        columnNames: ['chave_erp'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'caixa_pagamentos_erp',
      new TableIndex({
        name: 'idx_caixa_pag_erp_unidade_data',
        columnNames: ['unidade', 'data_operacao'],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'caixa_itens_erp',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'chave_erp',
            type: 'varchar',
            length: '80',
            isNullable: false,
          },
          {
            name: 'pagamento_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'unidade',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'data_operacao',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'numero_cupom',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'codigo_terminal',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'id_operacao',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'sequencia_item',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'tipo_item',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'codigo_requisicao_produto',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'numero_requisicao',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'descricao_item',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'quantidade',
            type: 'numeric',
            precision: 15,
            scale: 4,
            default: 0,
          },
          {
            name: 'valor_bruto_item',
            type: 'numeric',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'valor_liquido_item',
            type: 'numeric',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'desconto_item',
            type: 'numeric',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'valor_liquido_linha',
            type: 'numeric',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'importado_em',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'atualizado_em',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'caixa_itens_erp',
      new TableIndex({
        name: 'uq_caixa_itens_erp_chave',
        columnNames: ['chave_erp'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'caixa_itens_erp',
      new TableForeignKey({
        name: 'fk_caixa_itens_erp_pagamento',
        columnNames: ['pagamento_id'],
        referencedTableName: 'caixa_pagamentos_erp',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'caixa_requisicoes_pagas',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'chave_erp',
            type: 'varchar',
            length: '80',
            isNullable: false,
          },
          {
            name: 'unidade',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'data_pagamento',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'numero_requisicao',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'numero_cupom',
            type: 'integer',
            isNullable: false,
          },
          {
            name: 'numero_orcamento',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'quantidade_formulas',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'valor_orcamento',
            type: 'numeric',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'valor_requisicao_bruto',
            type: 'numeric',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'desconto_requisicao',
            type: 'numeric',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'valor_pago_requisicao',
            type: 'numeric',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'diferenca_interna_requisicao',
            type: 'numeric',
            precision: 15,
            scale: 2,
            default: 0,
          },
          {
            name: 'diferenca_orcamento_vs_pago',
            type: 'numeric',
            precision: 15,
            scale: 2,
            isNullable: true,
          },
          {
            name: 'codigo_vendedor',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'nome_vendedor',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'orcamento_id',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'importado_em',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'atualizado_em',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'caixa_requisicoes_pagas',
      new TableIndex({
        name: 'uq_caixa_requisicoes_pagas_chave',
        columnNames: ['chave_erp'],
        isUnique: true,
      }),
    );

    const orcamentosTable = await queryRunner.getTable('orcamentos');
    if (orcamentosTable) {
      await queryRunner.createForeignKey(
        'caixa_requisicoes_pagas',
        new TableForeignKey({
          name: 'fk_caixa_requisicoes_pagas_orcamento',
          columnNames: ['orcamento_id'],
          referencedTableName: 'orcamentos',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }

    console.log('✅ Tabelas caixa ERP criadas');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('caixa_requisicoes_pagas')) {
      await queryRunner.dropTable('caixa_requisicoes_pagas', true);
    }

    if (await queryRunner.hasTable('caixa_itens_erp')) {
      await queryRunner.dropTable('caixa_itens_erp', true);
    }

    if (await queryRunner.hasTable('caixa_pagamentos_erp')) {
      await queryRunner.dropTable('caixa_pagamentos_erp', true);
    }

    console.log('✅ Tabelas caixa ERP removidas');
  }
}
