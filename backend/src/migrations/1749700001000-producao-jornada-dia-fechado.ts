import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class ProducaoJornadaDiaFechado1749700001000 implements MigrationInterface {
  name = 'ProducaoJornadaDiaFechado1749700001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasTable('producao_jornada_dia');
    if (!exists) {
      await queryRunner.createTable(
        new Table({
          name: 'producao_jornada_dia',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'unidade', type: 'varchar', length: '32' },
            { name: 'diaSemana', type: 'smallint' },
            { name: 'fechado', type: 'boolean', default: true },
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
        'producao_jornada_dia',
        new TableUnique({
          name: 'uq_producao_jornada_dia_unidade_dia',
          columnNames: ['unidade', 'diaSemana'],
        }),
      );

      await queryRunner.createIndex(
        'producao_jornada_dia',
        new TableIndex({
          name: 'idx_producao_jornada_dia_unidade',
          columnNames: ['unidade'],
        }),
      );
    }

    if (await queryRunner.hasTable('producao_jornada_unidade')) {
      const temUnidades = await queryRunner.query(
        `SELECT 1 FROM producao_jornada_unidade LIMIT 1`,
      );
      if (Array.isArray(temUnidades) && temUnidades.length > 0) {
        await queryRunner.query(`
          INSERT INTO producao_jornada_dia (unidade, "diaSemana", fechado)
          SELECT u.unidade, d.dia, NOT EXISTS (
            SELECT 1 FROM producao_jornada_intervalo i
            WHERE i.unidade = u.unidade AND i."diaSemana" = d.dia
          )
          FROM producao_jornada_unidade u
          CROSS JOIN generate_series(0, 6) AS d(dia)
          ON CONFLICT ON CONSTRAINT uq_producao_jornada_dia_unidade_dia DO NOTHING
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('producao_jornada_dia')) {
      await queryRunner.dropTable('producao_jornada_dia');
    }
  }
}
