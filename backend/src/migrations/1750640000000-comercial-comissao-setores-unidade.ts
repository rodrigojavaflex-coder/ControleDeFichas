import { MigrationInterface, QueryRunner, Table, TableUnique } from 'typeorm';

/**
 * Setores de marca própria parametrizados por unidade
 * (card TOTAL do acompanhamento: Total vs recorte de setores).
 */
export class ComercialComissaoSetoresUnidade1750640000000
  implements MigrationInterface
{
  name = 'ComercialComissaoSetoresUnidade1750640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const polHas = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'comercial_comissao_politica'
        AND column_name = 'codigosSetor'
      LIMIT 1
    `);
    if (!polHas?.length) {
      await queryRunner.query(`
        ALTER TABLE comercial_comissao_politica
        ADD COLUMN "codigosSetor" integer[] NOT NULL DEFAULT '{}'
      `);
    }

    if (await queryRunner.hasTable('comercial_comissao_politica_unidade')) {
      return;
    }
    await queryRunner.createTable(
      new Table({
        name: 'comercial_comissao_politica_unidade',
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
            length: '32',
            isNullable: false,
          },
          {
            name: 'codigosSetor',
            type: 'int',
            isArray: true,
            default: `'{}'`,
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
          },
        ],
      }),
      true,
    );
    await queryRunner.createUniqueConstraint(
      'comercial_comissao_politica_unidade',
      new TableUnique({
        name: 'uq_comercial_comissao_politica_unidade',
        columnNames: ['unidade'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('comercial_comissao_politica_unidade')) {
      await queryRunner.dropTable('comercial_comissao_politica_unidade');
    }

    const polHas = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'comercial_comissao_politica'
        AND column_name = 'codigosSetor'
      LIMIT 1
    `);
    if (polHas?.length) {
      await queryRunner.query(`
        ALTER TABLE comercial_comissao_politica
        DROP COLUMN "codigosSetor"
      `);
    }
  }
}
