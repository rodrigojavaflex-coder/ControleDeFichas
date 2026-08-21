import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableCheck,
  TableForeignKey,
  TableIndex,
  TableUnique,
} from 'typeorm';

/**
 * Calendário por unidade (sábado útil), metas mensais de visitação e faixas
 * padrão de comissão. Sem alteração em perfil.permissoes.
 */
export class VisitacaoMetaComissaoCalendario1750400000000
  implements MigrationInterface
{
  name = 'VisitacaoMetaComissaoCalendario1750400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('calendario_unidade'))) {
      await queryRunner.createTable(
        new Table({
          name: 'calendario_unidade',
          columns: [
            {
              name: 'unidade',
              type: 'varchar',
              length: '32',
              isPrimary: true,
            },
            {
              name: 'sabadoDiaUtil',
              type: 'boolean',
              default: false,
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
    }

    if (!(await queryRunner.hasTable('visitacao_meta_representante'))) {
      await queryRunner.createTable(
        new Table({
          name: 'visitacao_meta_representante',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'funcionarioId', type: 'uuid' },
            { name: 'anoMes', type: 'varchar', length: '7' },
            { name: 'unidade', type: 'varchar', length: '32' },
            {
              name: 'valorMeta',
              type: 'numeric',
              precision: 14,
              scale: 2,
              default: 0,
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
        'visitacao_meta_representante',
        new TableUnique({
          name: 'uq_visitacao_meta_func_ano_mes',
          columnNames: ['funcionarioId', 'anoMes'],
        }),
      );

      await queryRunner.createIndex(
        'visitacao_meta_representante',
        new TableIndex({
          name: 'idx_visitacao_meta_unidade_ano_mes',
          columnNames: ['unidade', 'anoMes'],
        }),
      );

      await queryRunner.createCheckConstraint(
        'visitacao_meta_representante',
        new TableCheck({
          name: 'chk_visitacao_meta_valor',
          expression: '"valorMeta" >= 0',
        }),
      );

      await queryRunner.createForeignKey(
        'visitacao_meta_representante',
        new TableForeignKey({
          name: 'fk_visitacao_meta_funcionario',
          columnNames: ['funcionarioId'],
          referencedTableName: 'funcionarios',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
    }

    if (!(await queryRunner.hasTable('visitacao_comissao_faixa'))) {
      await queryRunner.createTable(
        new Table({
          name: 'visitacao_comissao_faixa',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            {
              name: 'percentualMetaDe',
              type: 'numeric',
              precision: 6,
              scale: 2,
            },
            {
              name: 'percentualMetaAte',
              type: 'numeric',
              precision: 6,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'percentualComissao',
              type: 'numeric',
              precision: 6,
              scale: 2,
            },
            { name: 'ordem', type: 'integer', default: 0 },
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
        'visitacao_comissao_faixa',
        new TableIndex({
          name: 'idx_visitacao_comissao_faixa_ordem',
          columnNames: ['ordem'],
        }),
      );

      await queryRunner.createCheckConstraint(
        'visitacao_comissao_faixa',
        new TableCheck({
          name: 'chk_visitacao_faixa_de',
          expression: '"percentualMetaDe" >= 0',
        }),
      );
      await queryRunner.createCheckConstraint(
        'visitacao_comissao_faixa',
        new TableCheck({
          name: 'chk_visitacao_faixa_ate',
          expression:
            '"percentualMetaAte" IS NULL OR "percentualMetaAte" > "percentualMetaDe"',
        }),
      );
      await queryRunner.createCheckConstraint(
        'visitacao_comissao_faixa',
        new TableCheck({
          name: 'chk_visitacao_faixa_comissao',
          expression: '"percentualComissao" >= 0',
        }),
      );
    }

    const [{ count }] = (await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM visitacao_comissao_faixa`,
    )) as Array<{ count: number }>;
    if (Number(count) === 0) {
      await queryRunner.query(`
        INSERT INTO visitacao_comissao_faixa
          ("percentualMetaDe", "percentualMetaAte", "percentualComissao", ordem)
        VALUES
          (0,    79.99, 0,   1),
          (80,   89.99, 1,   2),
          (90,   99.99, 1.5, 3),
          (100, 104.99, 2,   4),
          (105,  NULL,  2.5, 5)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('visitacao_comissao_faixa')) {
      await queryRunner.dropTable('visitacao_comissao_faixa');
    }
    if (await queryRunner.hasTable('visitacao_meta_representante')) {
      await queryRunner.dropTable('visitacao_meta_representante');
    }
    if (await queryRunner.hasTable('calendario_unidade')) {
      await queryRunner.dropTable('calendario_unidade');
    }
  }
}
