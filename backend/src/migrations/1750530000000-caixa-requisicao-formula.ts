import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Linhas FC12100 (SERIER) da requisição paga — crédito por fórmula (RN-VIS-008 / RN-CXA-003).
 */
export class CaixaRequisicaoFormula1750530000000 implements MigrationInterface {
  name = 'CaixaRequisicaoFormula1750530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('caixa_requisicoes_pagas'))) {
      return;
    }
    if (await queryRunner.hasTable('caixa_requisicao_formula')) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'caixa_requisicao_formula',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          { name: 'requisicao_paga_id', type: 'uuid', isNullable: false },
          { name: 'unidade', type: 'varchar', length: '20', isNullable: false },
          { name: 'data_pagamento', type: 'date', isNullable: false },
          { name: 'numero_requisicao', type: 'integer', isNullable: false },
          { name: 'serie', type: 'varchar', length: '10', isNullable: false },
          { name: 'numero_orcamento', type: 'integer', isNullable: true },
          {
            name: 'valor_prcobr',
            type: 'numeric',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'valor_rateado',
            type: 'numeric',
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: 'nome_medico',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'crm_medico',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'uf_crm_medico',
            type: 'varchar',
            length: '2',
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
      'caixa_requisicao_formula',
      new TableIndex({
        name: 'uq_caixa_requisicao_formula_paga_serie',
        columnNames: ['requisicao_paga_id', 'serie'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'caixa_requisicao_formula',
      new TableIndex({
        name: 'idx_caixa_requisicao_formula_unidade_req',
        columnNames: ['unidade', 'numero_requisicao'],
      }),
    );
    await queryRunner.createIndex(
      'caixa_requisicao_formula',
      new TableIndex({
        name: 'idx_caixa_requisicao_formula_crm',
        columnNames: ['crm_medico', 'uf_crm_medico'],
      }),
    );
    await queryRunner.createForeignKey(
      'caixa_requisicao_formula',
      new TableForeignKey({
        name: 'fk_caixa_requisicao_formula_paga',
        columnNames: ['requisicao_paga_id'],
        referencedTableName: 'caixa_requisicoes_pagas',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('caixa_requisicao_formula'))) {
      return;
    }
    await queryRunner.dropTable('caixa_requisicao_formula', true);
  }
}
