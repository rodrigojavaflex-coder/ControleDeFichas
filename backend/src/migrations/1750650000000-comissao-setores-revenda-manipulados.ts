import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Setores de revenda (PRODUTO) que somam no card de Manipulados.
 * Vazio = não soma revenda (somente requisições). Independente dos
 * setores de marca própria.
 */
export class ComissaoSetoresRevendaManipulados1750650000000
  implements MigrationInterface
{
  name = 'ComissaoSetoresRevendaManipulados1750650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const polHas = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'comercial_comissao_politica'
        AND column_name = 'codigosSetorRevendaManipulados'
      LIMIT 1
    `);
    if (!polHas?.length) {
      await queryRunner.query(`
        ALTER TABLE comercial_comissao_politica
        ADD COLUMN "codigosSetorRevendaManipulados" integer[] NOT NULL DEFAULT '{}'
      `);
    }

    const unHas = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'comercial_comissao_politica_unidade'
        AND column_name = 'codigosSetorRevendaManipulados'
      LIMIT 1
    `);
    if (!unHas?.length) {
      await queryRunner.query(`
        ALTER TABLE comercial_comissao_politica_unidade
        ADD COLUMN "codigosSetorRevendaManipulados" integer[] NOT NULL DEFAULT '{}'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const unHas = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'comercial_comissao_politica_unidade'
        AND column_name = 'codigosSetorRevendaManipulados'
      LIMIT 1
    `);
    if (unHas?.length) {
      await queryRunner.query(`
        ALTER TABLE comercial_comissao_politica_unidade
        DROP COLUMN "codigosSetorRevendaManipulados"
      `);
    }

    const polHas = await queryRunner.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'comercial_comissao_politica'
        AND column_name = 'codigosSetorRevendaManipulados'
      LIMIT 1
    `);
    if (polHas?.length) {
      await queryRunner.query(`
        ALTER TABLE comercial_comissao_politica
        DROP COLUMN "codigosSetorRevendaManipulados"
      `);
    }
  }
}
