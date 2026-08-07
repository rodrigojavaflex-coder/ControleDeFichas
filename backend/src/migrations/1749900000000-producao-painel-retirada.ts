import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class ProducaoPainelRetirada1749900000000 implements MigrationInterface {
  name = 'ProducaoPainelRetirada1749900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const etapaFinalExists = await queryRunner.hasTable(
      'producao_painel_etapa_final',
    );
    if (!etapaFinalExists) {
      await queryRunner.createTable(
        new Table({
          name: 'producao_painel_etapa_final',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'unidade', type: 'varchar', length: '32' },
            { name: 'codEtapa', type: 'varchar', length: '20' },
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
        'producao_painel_etapa_final',
        new TableUnique({
          name: 'uq_producao_painel_etapa_final_unidade_cod',
          columnNames: ['unidade', 'codEtapa'],
        }),
      );
      await queryRunner.createIndex(
        'producao_painel_etapa_final',
        new TableIndex({
          name: 'idx_producao_painel_etapa_final_unidade',
          columnNames: ['unidade'],
        }),
      );
    }

    const alertaExists = await queryRunner.hasTable(
      'producao_painel_alerta_retirada',
    );
    if (!alertaExists) {
      await queryRunner.createTable(
        new Table({
          name: 'producao_painel_alerta_retirada',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'unidade', type: 'varchar', length: '32' },
            { name: 'ordem', type: 'integer', default: 0 },
            { name: 'tipo', type: 'varchar', length: '16' },
            { name: 'minutosAntes', type: 'integer', isNullable: true },
            { name: 'cor', type: 'varchar', length: '16' },
            { name: 'rotulo', type: 'varchar', length: '120', isNullable: true },
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
        'producao_painel_alerta_retirada',
        new TableIndex({
          name: 'idx_producao_painel_alerta_unidade_ordem',
          columnNames: ['unidade', 'ordem'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('producao_painel_alerta_retirada', true);
    await queryRunner.dropTable('producao_painel_etapa_final', true);
  }
}
