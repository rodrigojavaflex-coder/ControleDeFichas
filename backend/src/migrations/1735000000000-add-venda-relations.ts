import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddVendaRelations1735000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('vendas');
    
    // Verificar e adicionar coluna clienteId se não existir
    const clienteIdColumn = table?.findColumnByName('clienteId');
    if (!clienteIdColumn) {
      await queryRunner.addColumn(
        'vendas',
        new TableColumn({
          name: 'clienteId',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    // Verificar e adicionar coluna vendedorId se não existir
    const vendedorIdColumn = table?.findColumnByName('vendedorId');
    if (!vendedorIdColumn) {
      await queryRunner.addColumn(
        'vendas',
        new TableColumn({
          name: 'vendedorId',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    // Verificar e adicionar coluna prescritorId se não existir
    const prescritorIdColumn = table?.findColumnByName('prescritorId');
    if (!prescritorIdColumn) {
      await queryRunner.addColumn(
        'vendas',
        new TableColumn({
          name: 'prescritorId',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }
    
    // Foreign keys serão criadas em uma migration posterior (1735000002000),
    // após as tabelas clientes, vendedores e prescritores serem criadas
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover colunas (remover foreign keys primeiro se existirem)
    const table = await queryRunner.getTable('vendas');
    if (table) {
      // Verificar se foreign keys existem e removê-las primeiro
      const existingForeignKeys = table.foreignKeys || [];
      const clienteFk = existingForeignKeys.find(fk => fk.name === 'FK_vendas_cliente');
      const vendedorFk = existingForeignKeys.find(fk => fk.name === 'FK_vendas_vendedor');
      const prescritorFk = existingForeignKeys.find(fk => fk.name === 'FK_vendas_prescritor');

      if (clienteFk) await queryRunner.dropForeignKey('vendas', clienteFk);
      if (vendedorFk) await queryRunner.dropForeignKey('vendas', vendedorFk);
      if (prescritorFk) await queryRunner.dropForeignKey('vendas', prescritorFk);

      // Remover colunas
      const clienteIdColumn = table.findColumnByName('clienteId');
      const vendedorIdColumn = table.findColumnByName('vendedorId');
      const prescritorIdColumn = table.findColumnByName('prescritorId');

      if (clienteIdColumn) await queryRunner.dropColumn('vendas', 'clienteId');
      if (vendedorIdColumn) await queryRunner.dropColumn('vendas', 'vendedorId');
      if (prescritorIdColumn) await queryRunner.dropColumn('vendas', 'prescritorId');
    }
  }
}

