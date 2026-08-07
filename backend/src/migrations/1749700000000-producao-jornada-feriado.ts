import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class ProducaoJornadaFeriado1749700000000 implements MigrationInterface {
  name = 'ProducaoJornadaFeriado1749700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const jornadaUnidadeExists = await queryRunner.hasTable(
      'producao_jornada_unidade',
    );
    if (!jornadaUnidadeExists) {
      await queryRunner.createTable(
        new Table({
          name: 'producao_jornada_unidade',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'unidade', type: 'varchar', length: '32' },
            { name: 'configurado', type: 'boolean', default: false },
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
        'producao_jornada_unidade',
        new TableUnique({
          name: 'uq_producao_jornada_unidade',
          columnNames: ['unidade'],
        }),
      );
    }

    const intervaloExists = await queryRunner.hasTable(
      'producao_jornada_intervalo',
    );
    if (!intervaloExists) {
      await queryRunner.createTable(
        new Table({
          name: 'producao_jornada_intervalo',
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
            { name: 'ordem', type: 'smallint', default: 0 },
            { name: 'horaInicio', type: 'varchar', length: '8' },
            { name: 'horaFim', type: 'varchar', length: '8' },
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

      await queryRunner.createIndex(
        'producao_jornada_intervalo',
        new TableIndex({
          name: 'idx_producao_jornada_int_unidade_dia',
          columnNames: ['unidade', 'diaSemana', 'ordem'],
        }),
      );
    }

    const feriadoExists = await queryRunner.hasTable('producao_feriado');
    if (!feriadoExists) {
      await queryRunner.createTable(
        new Table({
          name: 'producao_feriado',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'unidade', type: 'varchar', length: '32' },
            { name: 'data', type: 'varchar', length: '10' },
            { name: 'descricao', type: 'varchar', length: '200', isNullable: true },
            {
              name: 'origem',
              type: 'varchar',
              length: '16',
              default: "'manual'",
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
        'producao_feriado',
        new TableUnique({
          name: 'uq_producao_feriado_unidade_data',
          columnNames: ['unidade', 'data'],
        }),
      );

      await queryRunner.createIndex(
        'producao_feriado',
        new TableIndex({
          name: 'idx_producao_feriado_unidade_data',
          columnNames: ['unidade', 'data'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('producao_feriado')) {
      await queryRunner.dropTable('producao_feriado');
    }
    if (await queryRunner.hasTable('producao_jornada_intervalo')) {
      await queryRunner.dropTable('producao_jornada_intervalo');
    }
    if (await queryRunner.hasTable('producao_jornada_unidade')) {
      await queryRunner.dropTable('producao_jornada_unidade');
    }
  }
}
