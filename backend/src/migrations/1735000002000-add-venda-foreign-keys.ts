import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class AddVendaForeignKeys1735000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar se tabelas existem antes de criar foreign keys
    const clientesTable = await queryRunner.getTable('clientes');
    const vendedoresTable = await queryRunner.getTable('vendedores');
    const prescritoresTable = await queryRunner.getTable('prescritores');
    
    if (!clientesTable || !vendedoresTable || !prescritoresTable) {
      throw new Error('Tabelas clientes, vendedores ou prescritores não existem. Execute a migration de criação de tabelas (1735000001000) primeiro.');
    }

    const table = await queryRunner.getTable('vendas');
    if (!table) {
      throw new Error('Tabela vendas não existe.');
    }

    const existingForeignKeys = table.foreignKeys || [];
    
    // Verificar se as colunas existem
    const clienteIdColumn = table.findColumnByName('clienteId');
    const vendedorIdColumn = table.findColumnByName('vendedorId');
    const prescritorIdColumn = table.findColumnByName('prescritorId');

    if (!clienteIdColumn || !vendedorIdColumn || !prescritorIdColumn) {
      throw new Error('Colunas clienteId, vendedorId ou prescritorId não existem na tabela vendas. Execute a migration de adição de colunas (1735000000000) primeiro.');
    }
    
    // Adicionar foreign key para cliente
    const clienteFkExists = existingForeignKeys.some(fk => fk.name === 'FK_vendas_cliente');
    if (!clienteFkExists) {
      await queryRunner.createForeignKey(
        'vendas',
        new TableForeignKey({
          columnNames: ['clienteId'],
          referencedTableName: 'clientes',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
          name: 'FK_vendas_cliente',
        }),
      );
    }

    // Adicionar foreign key para vendedor
    const vendedorFkExists = existingForeignKeys.some(fk => fk.name === 'FK_vendas_vendedor');
    if (!vendedorFkExists) {
      await queryRunner.createForeignKey(
        'vendas',
        new TableForeignKey({
          columnNames: ['vendedorId'],
          referencedTableName: 'vendedores',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
          name: 'FK_vendas_vendedor',
        }),
      );
    }

    // Adicionar foreign key para prescritor
    const prescritorFkExists = existingForeignKeys.some(fk => fk.name === 'FK_vendas_prescritor');
    if (!prescritorFkExists) {
      await queryRunner.createForeignKey(
        'vendas',
        new TableForeignKey({
          columnNames: ['prescritorId'],
          referencedTableName: 'prescritores',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
          name: 'FK_vendas_prescritor',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('vendas');
    if (table) {
      const existingForeignKeys = table.foreignKeys || [];
      const clienteFk = existingForeignKeys.find(fk => fk.name === 'FK_vendas_cliente');
      const vendedorFk = existingForeignKeys.find(fk => fk.name === 'FK_vendas_vendedor');
      const prescritorFk = existingForeignKeys.find(fk => fk.name === 'FK_vendas_prescritor');

      if (clienteFk) await queryRunner.dropForeignKey('vendas', clienteFk);
      if (vendedorFk) await queryRunner.dropForeignKey('vendas', vendedorFk);
      if (prescritorFk) await queryRunner.dropForeignKey('vendas', prescritorFk);
    }
  }
}
