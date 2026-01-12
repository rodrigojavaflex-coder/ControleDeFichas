import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class AddVendedorToUsuarios1735000004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar se a tabela vendedores existe
    const vendedoresTable = await queryRunner.getTable('vendedores');
    if (!vendedoresTable) {
      throw new Error('Tabela vendedores não existe. Execute a migration de criação de tabelas (1735000001000) primeiro.');
    }

    const usuariosTable = await queryRunner.getTable('usuarios');
    if (!usuariosTable) {
      throw new Error('Tabela usuarios não existe.');
    }

    // Verificar se a coluna já existe
    const vendedorIdColumn = usuariosTable.findColumnByName('vendedorId');
    if (vendedorIdColumn) {
      console.log('⚠️  Coluna vendedorId já existe na tabela usuarios');
      return;
    }

    // Adicionar coluna vendedorId
    await queryRunner.addColumn(
      'usuarios',
      new TableColumn({
        name: 'vendedorId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    console.log('✅ Coluna vendedorId adicionada na tabela usuarios');

    // Adicionar foreign key
    const existingForeignKeys = usuariosTable.foreignKeys || [];
    const vendedorFkExists = existingForeignKeys.some(fk => fk.name === 'FK_usuarios_vendedor');
    
    if (!vendedorFkExists) {
      await queryRunner.createForeignKey(
        'usuarios',
        new TableForeignKey({
          columnNames: ['vendedorId'],
          referencedTableName: 'vendedores',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
          name: 'FK_usuarios_vendedor',
        }),
      );
      console.log('✅ Foreign key FK_usuarios_vendedor criada');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const usuariosTable = await queryRunner.getTable('usuarios');
    if (usuariosTable) {
      // Remover foreign key
      const existingForeignKeys = usuariosTable.foreignKeys || [];
      const vendedorFk = existingForeignKeys.find(fk => fk.name === 'FK_usuarios_vendedor');
      
      if (vendedorFk) {
        await queryRunner.dropForeignKey('usuarios', vendedorFk);
        console.log('✅ Foreign key FK_usuarios_vendedor removida');
      }

      // Remover coluna
      const vendedorIdColumn = usuariosTable.findColumnByName('vendedorId');
      if (vendedorIdColumn) {
        await queryRunner.dropColumn('usuarios', 'vendedorId');
        console.log('✅ Coluna vendedorId removida da tabela usuarios');
      }
    }
  }
}
