import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateCadastrosTables1735000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verificar se tabela clientes já existe
    const clientesTable = await queryRunner.getTable('clientes');
    if (!clientesTable) {
      await queryRunner.createTable(
        new Table({
          name: 'clientes',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'nome',
              type: 'varchar',
              length: '500',
              isNullable: false,
            },
            {
              name: 'cdcliente',
              type: 'integer',
              isNullable: true,
            },
            {
              name: 'cpf',
              type: 'varchar',
              length: '14',
              isNullable: true,
            },
            {
              name: 'dataNascimento',
              type: 'date',
              isNullable: true,
            },
            {
              name: 'email',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'telefone',
              type: 'varchar',
              length: '20',
              isNullable: true,
            },
            {
              name: 'unidade',
              type: 'enum',
              enum: ['INHUMAS', 'NERÓPOLIS', 'UBERABA'],
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

      // Índices para clientes
      await queryRunner.createIndex(
        'clientes',
        new TableIndex({
          name: 'idx_clientes_unidade',
          columnNames: ['unidade'],
        }),
      );
      await queryRunner.createIndex(
        'clientes',
        new TableIndex({
          name: 'idx_clientes_cdcliente',
          columnNames: ['cdcliente'],
        }),
      );
    }

    // Verificar se tabela vendedores já existe
    const vendedoresTable = await queryRunner.getTable('vendedores');
    if (!vendedoresTable) {
      await queryRunner.createTable(
        new Table({
          name: 'vendedores',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'nome',
              type: 'varchar',
              length: '500',
              isNullable: false,
            },
            {
              name: 'cdVendedor',
              type: 'integer',
              isNullable: true,
            },
            {
              name: 'unidade',
              type: 'enum',
              enum: ['INHUMAS', 'NERÓPOLIS', 'UBERABA'],
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

      // Índices para vendedores
      await queryRunner.createIndex(
        'vendedores',
        new TableIndex({
          name: 'idx_vendedores_unidade',
          columnNames: ['unidade'],
        }),
      );
      await queryRunner.createIndex(
        'vendedores',
        new TableIndex({
          name: 'idx_vendedores_cdVendedor',
          columnNames: ['cdVendedor'],
        }),
      );
    }

    // Verificar se tabela prescritores já existe
    const prescritoresTable = await queryRunner.getTable('prescritores');
    if (!prescritoresTable) {
      await queryRunner.createTable(
        new Table({
          name: 'prescritores',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'nome',
              type: 'varchar',
              length: '500',
              isNullable: false,
            },
            {
              name: 'numeroCRM',
              type: 'integer',
              isNullable: true,
            },
            {
              name: 'UFCRM',
              type: 'varchar',
              length: '2',
              isNullable: true,
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

      // Índices para prescritores
      await queryRunner.createIndex(
        'prescritores',
        new TableIndex({
          name: 'idx_prescritores_numeroCRM',
          columnNames: ['numeroCRM'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover índices primeiro
    const prescritoresTable = await queryRunner.getTable('prescritores');
    if (prescritoresTable) {
      const idxPrescritoresCRM = prescritoresTable.indices.find(
        (idx) => idx.name === 'idx_prescritores_numeroCRM',
      );
      if (idxPrescritoresCRM) {
        await queryRunner.dropIndex('prescritores', 'idx_prescritores_numeroCRM');
      }
      await queryRunner.dropTable('prescritores');
    }

    const vendedoresTable = await queryRunner.getTable('vendedores');
    if (vendedoresTable) {
      const idxVendedoresUnidade = vendedoresTable.indices.find(
        (idx) => idx.name === 'idx_vendedores_unidade',
      );
      if (idxVendedoresUnidade) {
        await queryRunner.dropIndex('vendedores', 'idx_vendedores_unidade');
      }
      const idxVendedoresCd = vendedoresTable.indices.find(
        (idx) => idx.name === 'idx_vendedores_cdVendedor',
      );
      if (idxVendedoresCd) {
        await queryRunner.dropIndex('vendedores', 'idx_vendedores_cdVendedor');
      }
      await queryRunner.dropTable('vendedores');
    }

    const clientesTable = await queryRunner.getTable('clientes');
    if (clientesTable) {
      const idxClientesUnidade = clientesTable.indices.find(
        (idx) => idx.name === 'idx_clientes_unidade',
      );
      if (idxClientesUnidade) {
        await queryRunner.dropIndex('clientes', 'idx_clientes_unidade');
      }
      const idxClientesCd = clientesTable.indices.find(
        (idx) => idx.name === 'idx_clientes_cdcliente',
      );
      if (idxClientesCd) {
        await queryRunner.dropIndex('clientes', 'idx_clientes_cdcliente');
      }
      await queryRunner.dropTable('clientes');
    }
  }
}
