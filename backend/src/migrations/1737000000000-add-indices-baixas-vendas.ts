import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddIndicesBaixasVendas1737000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar se a tabela vendas existe
    const vendasTable = await queryRunner.getTable('vendas');
    if (!vendasTable) {
      throw new Error('Tabela vendas não existe.');
    }

    // Verificar se a tabela baixas existe
    const baixasTable = await queryRunner.getTable('baixas');
    if (!baixasTable) {
      throw new Error('Tabela baixas não existe.');
    }

    // Verificar se o índice em vendas.unidade já existe
    const vendasTableWithIndices = await queryRunner.getTable('vendas');
    const idxVendasUnidadeExists = vendasTableWithIndices?.indices.some(
      (idx) => idx.name === 'idx_vendas_unidade'
    );

    if (!idxVendasUnidadeExists) {
      await queryRunner.createIndex(
        'vendas',
        new TableIndex({
          name: 'idx_vendas_unidade',
          columnNames: ['unidade'],
        })
      );
      console.log('Índice idx_vendas_unidade criado com sucesso.');
    } else {
      console.log('Índice idx_vendas_unidade já existe.');
    }

    // Verificar se o índice em baixas.data_baixa já existe
    const baixasTableWithIndices = await queryRunner.getTable('baixas');
    const idxBaixasDataBaixaExists = baixasTableWithIndices?.indices.some(
      (idx) => idx.name === 'idx_baixas_data_baixa'
    );

    if (!idxBaixasDataBaixaExists) {
      await queryRunner.createIndex(
        'baixas',
        new TableIndex({
          name: 'idx_baixas_data_baixa',
          columnNames: ['dataBaixa'],
          isUnique: false,
        })
      );
      console.log('Índice idx_baixas_data_baixa criado com sucesso.');
    } else {
      console.log('Índice idx_baixas_data_baixa já existe.');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Verificar se os índices existem antes de remover
    const vendasTable = await queryRunner.getTable('vendas');
    const idxVendasUnidade = vendasTable?.indices.find(
      (idx) => idx.name === 'idx_vendas_unidade'
    );

    if (idxVendasUnidade) {
      await queryRunner.dropIndex('vendas', 'idx_vendas_unidade');
      console.log('Índice idx_vendas_unidade removido.');
    }

    const baixasTable = await queryRunner.getTable('baixas');
    const idxBaixasDataBaixa = baixasTable?.indices.find(
      (idx) => idx.name === 'idx_baixas_data_baixa'
    );

    if (idxBaixasDataBaixa) {
      await queryRunner.dropIndex('baixas', 'idx_baixas_data_baixa');
      console.log('Índice idx_baixas_data_baixa removido.');
    }
  }
}
