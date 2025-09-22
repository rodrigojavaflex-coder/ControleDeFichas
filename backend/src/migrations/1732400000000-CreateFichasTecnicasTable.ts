import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateFichasTecnicasTable1732400000000 implements MigrationInterface {
  name = 'CreateFichasTecnicasTable1732400000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'fichas_tecnicas',
      columns: [
        {
          name: 'codigo_formula_certa',
          type: 'bigint',
          isPrimary: true,
          isGenerated: true,
          generationStrategy: 'increment',
        },
        {
          name: 'produto',
          type: 'varchar',
          length: '100',
          isNullable: false,
        },
        {
          name: 'peso_molecular',
          type: 'varchar',
          length: '100',
          isNullable: false,
        },
        {
          name: 'formula_molecular',
          type: 'varchar',
          length: '100',
          isNullable: false,
        },
        {
          name: 'dcb',
          type: 'varchar',
          length: '100',
          isNullable: false,
        },
        {
          name: 'nome_cientifico',
          type: 'varchar',
          length: '100',
          isNullable: false,
        },
        {
          name: 'revisao',
          type: 'varchar',
          length: '100',
          isNullable: false,
        },
        {
          name: 'analise',
          type: 'varchar',
          length: '100',
          isNullable: false,
        },
        {
          name: 'caracteristicas_organolepticas',
          type: 'varchar',
          length: '100',
          isNullable: false,
        },
        {
          name: 'solubilidade',
          type: 'varchar',
          length: '100',
          isNullable: false,
        },
        {
          name: 'faixa_ph',
          type: 'varchar',
          length: '100',
          isNullable: false,
        },
        {
          name: 'faixa_fusao',
          type: 'varchar',
          length: '100',
          isNullable: false,
        },
        {
          name: 'peso',
          type: 'varchar',
          length: '100',
          isNullable: true,
        },
        {
          name: 'volume',
          type: 'varchar',
          length: '100',
          isNullable: true,
        },
        {
          name: 'densidade_com_compactacao',
          type: 'varchar',
          length: '100',
          isNullable: true,
        },
        {
          name: 'avaliacao_do_laudo',
          type: 'varchar',
          length: '100',
          isNullable: true,
        },
        {
          name: 'cinzas',
          type: 'varchar',
          length: '100',
          isNullable: true,
        },
        {
          name: 'perda_por_secagem',
          type: 'varchar',
          length: '100',
          isNullable: true,
        },
        {
          name: 'infra_vermelho',
          type: 'varchar',
          length: '100',
          isNullable: true,
        },
        {
          name: 'ultra_violeta',
          type: 'varchar',
          length: '100',
          isNullable: true,
        },
        {
          name: 'teor',
          type: 'varchar',
          length: '100',
          isNullable: true,
        },
        {
          name: 'conservacao',
          type: 'varchar',
          length: '100',
          isNullable: true,
        },
        {
          name: 'observacao_01',
          type: 'varchar',
          length: '100',
          isNullable: true,
        },
        {
          name: 'amostragem',
          type: 'text',
          isNullable: true,
        },
        {
          name: 'referencia_bibliografica',
          type: 'varchar',
          length: '100',
          isNullable: true,
        },
        {
          name: 'data_de_analise',
          type: 'date',
          isNullable: false,
        },
        {
          name: 'created_at',
          type: 'timestamp',
          default: 'CURRENT_TIMESTAMP',
        },
        {
          name: 'updated_at',
          type: 'timestamp',
          default: 'CURRENT_TIMESTAMP',
          onUpdate: 'CURRENT_TIMESTAMP',
        },
      ],
      indices: [
        {
          name: 'IDX_ficha_tecnica_produto',
          columnNames: ['produto'],
        },
        {
          name: 'IDX_ficha_tecnica_dcb',
          columnNames: ['dcb'],
        },
        {
          name: 'IDX_ficha_tecnica_nome_cientifico',
          columnNames: ['nome_cientifico'],
        },
        {
          name: 'IDX_ficha_tecnica_data_analise',
          columnNames: ['data_de_analise'],
        },
        {
          name: 'IDX_ficha_tecnica_created_at',
          columnNames: ['created_at'],
        },
      ],
    }), true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('fichas_tecnicas');
  }
}