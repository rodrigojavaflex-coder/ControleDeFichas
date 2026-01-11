import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RemoveTextFieldsFromVendas1735000003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('vendas');
    if (!table) {
      throw new Error('Tabela vendas não existe.');
    }

    // Verificar se as foreign keys existem antes de remover as colunas
    const clienteIdColumn = table.findColumnByName('clienteId');
    const vendedorIdColumn = table.findColumnByName('vendedorId');
    const prescritorIdColumn = table.findColumnByName('prescritorId');

    if (!clienteIdColumn || !vendedorIdColumn) {
      throw new Error('Colunas clienteId ou vendedorId não existem. Execute as migrations anteriores primeiro.');
    }

    // VERIFICAÇÕES DE SEGURANÇA: Garantir que todos os dados foram migrados
    console.log('🔍 Verificando se todos os dados foram migrados antes de remover campos texto...');
    
    // Verificar se as tabelas de cadastros existem antes de fazer verificações
    const clientesTable = await queryRunner.getTable('clientes');
    const vendedoresTable = await queryRunner.getTable('vendedores');
    
    // Verificar se há vendas sem clienteId ou vendedorId
    const vendasSemRelacionamento = await queryRunner.query(`
      SELECT COUNT(*) as total
      FROM vendas
      WHERE "clienteId" IS NULL OR "vendedorId" IS NULL
    `);
    
    const totalSemRelacionamento = parseInt(vendasSemRelacionamento[0]?.total || '0');
    
    if (totalSemRelacionamento > 0) {
      throw new Error(
        `❌ ATENÇÃO: Existem ${totalSemRelacionamento} venda(s) sem relacionamento (clienteId ou vendedorId NULL). ` +
        `Execute primeiro a migração de dados (POST /api/migracao/vendas-relacoes) antes de remover os campos texto.`
      );
    }

    // Só fazer verificações de integridade se as tabelas existirem
    if (clientesTable) {
      // Verificar se há vendas com clienteId mas sem cliente relacionado
      const vendasComClienteIdInvalido = await queryRunner.query(`
        SELECT COUNT(*) as total
        FROM vendas v
        LEFT JOIN clientes c ON v."clienteId" = c.id
        WHERE v."clienteId" IS NOT NULL AND c.id IS NULL
      `);
      
      const totalClienteInvalido = parseInt(vendasComClienteIdInvalido[0]?.total || '0');
      
      if (totalClienteInvalido > 0) {
        throw new Error(
          `❌ ATENÇÃO: Existem ${totalClienteInvalido} venda(s) com clienteId inválido (cliente não encontrado). ` +
          `Corrija os dados antes de remover os campos texto.`
        );
      }
    }

    if (vendedoresTable) {
      // Verificar se há vendas com vendedorId mas sem vendedor relacionado
      const vendasComVendedorIdInvalido = await queryRunner.query(`
        SELECT COUNT(*) as total
        FROM vendas v
        LEFT JOIN vendedores ve ON v."vendedorId" = ve.id
        WHERE v."vendedorId" IS NOT NULL AND ve.id IS NULL
      `);
      
      const totalVendedorInvalido = parseInt(vendasComVendedorIdInvalido[0]?.total || '0');
      
      if (totalVendedorInvalido > 0) {
        throw new Error(
          `❌ ATENÇÃO: Existem ${totalVendedorInvalido} venda(s) com vendedorId inválido (vendedor não encontrado). ` +
          `Corrija os dados antes de remover os campos texto.`
        );
      }
    }

    console.log('✅ Todas as verificações passaram. Removendo campos texto...');

    // Remover coluna cliente
    const clienteColumn = table.findColumnByName('cliente');
    if (clienteColumn) {
      console.log('🗑️  Removendo coluna "cliente"...');
      await queryRunner.dropColumn('vendas', 'cliente');
      console.log('✅ Coluna "cliente" removida com sucesso');
    }

    // Remover coluna vendedor
    const vendedorColumn = table.findColumnByName('vendedor');
    if (vendedorColumn) {
      console.log('🗑️  Removendo coluna "vendedor"...');
      await queryRunner.dropColumn('vendas', 'vendedor');
      console.log('✅ Coluna "vendedor" removida com sucesso');
    }

    // Remover coluna prescritor
    const prescritorColumn = table.findColumnByName('prescritor');
    if (prescritorColumn) {
      console.log('🗑️  Removendo coluna "prescritor"...');
      await queryRunner.dropColumn('vendas', 'prescritor');
      console.log('✅ Coluna "prescritor" removida com sucesso');
    }

    console.log('✅ Migration concluída: Campos texto removidos com sucesso!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('vendas');
    if (!table) {
      throw new Error('Tabela vendas não existe.');
    }

    // Recriar coluna cliente
    const clienteColumn = table.findColumnByName('cliente');
    if (!clienteColumn) {
      await queryRunner.addColumn(
        'vendas',
        new TableColumn({
          name: 'cliente',
          type: 'varchar',
          length: '300',
          isNullable: false,
        }),
      );
    }

    // Recriar coluna vendedor
    const vendedorColumn = table.findColumnByName('vendedor');
    if (!vendedorColumn) {
      await queryRunner.addColumn(
        'vendas',
        new TableColumn({
          name: 'vendedor',
          type: 'varchar',
          length: '300',
          isNullable: false,
        }),
      );
    }

    // Recriar coluna prescritor
    const prescritorColumn = table.findColumnByName('prescritor');
    if (!prescritorColumn) {
      await queryRunner.addColumn(
        'vendas',
        new TableColumn({
          name: 'prescritor',
          type: 'varchar',
          length: '300',
          isNullable: true,
        }),
      );
    }
  }
}
