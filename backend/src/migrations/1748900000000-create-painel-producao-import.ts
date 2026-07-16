import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableUnique,
} from 'typeorm';

export class CreatePainelProducaoImport1748900000000
  implements MigrationInterface
{
  name = 'CreatePainelProducaoImport1748900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const configTable = await queryRunner.getTable('sincronizacao_config');
    if (configTable) {
      if (!configTable.findColumnByName('painelContratoRepresentantes')) {
        await queryRunner.query(`
          ALTER TABLE sincronizacao_config
          ADD COLUMN "painelContratoRepresentantes" varchar(100) NULL
        `);
      }
      if (!configTable.findColumnByName('ultimaModificacaoProducaoEtapas')) {
        await queryRunner.query(`
          ALTER TABLE sincronizacao_config
          ADD COLUMN "ultimaModificacaoProducaoEtapas" timestamp NULL
        `);
      }
    }

    const painelExists = await queryRunner.hasTable('painel_medicos_representantes');
    if (!painelExists) {
      await queryRunner.createTable(
        new Table({
          name: 'painel_medicos_representantes',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'unidade', type: 'varchar', length: '20' },
            { name: 'nomeMedico', type: 'varchar', length: '500' },
            { name: 'ufCrmMedico', type: 'varchar', length: '2' },
            { name: 'crmMedico', type: 'varchar', length: '20' },
            { name: 'contratoRepresentante', type: 'integer' },
            { name: 'codigoRepresentante', type: 'integer' },
            { name: 'nomeRepresentante', type: 'varchar', length: '500' },
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
        'painel_medicos_representantes',
        new TableUnique({
          name: 'uq_painel_medico_rep',
          columnNames: [
            'unidade',
            'crmMedico',
            'ufCrmMedico',
            'contratoRepresentante',
            'codigoRepresentante',
          ],
        }),
      );

      await queryRunner.createIndex(
        'painel_medicos_representantes',
        new TableIndex({
          name: 'idx_painel_unidade_rep',
          columnNames: [
            'unidade',
            'contratoRepresentante',
            'codigoRepresentante',
          ],
        }),
      );
    }

    const historicoExists = await queryRunner.hasTable(
      'painel_medicos_representantes_historico',
    );
    if (!historicoExists) {
      await queryRunner.createTable(
        new Table({
          name: 'painel_medicos_representantes_historico',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'unidade', type: 'varchar', length: '20' },
            { name: 'nomeMedico', type: 'varchar', length: '500' },
            { name: 'ufCrmMedico', type: 'varchar', length: '2' },
            { name: 'crmMedico', type: 'varchar', length: '20' },
            { name: 'contratoRepresentante', type: 'integer' },
            { name: 'codigoRepresentante', type: 'integer' },
            { name: 'nomeRepresentante', type: 'varchar', length: '500' },
            {
              name: 'configNoMomento',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            { name: 'motivoRemocao', type: 'varchar', length: '30' },
            { name: 'removidoEm', type: 'timestamp' },
            { name: 'origemPainelId', type: 'uuid', isNullable: true },
            { name: 'criadoEmPainel', type: 'timestamp', isNullable: true },
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
        'painel_medicos_representantes_historico',
        new TableIndex({
          name: 'idx_painel_hist_unidade_removido',
          columnNames: ['unidade', 'removidoEm'],
        }),
      );
    }

    const etapasExists = await queryRunner.hasTable('producao_etapas_resumo');
    if (!etapasExists) {
      await queryRunner.createTable(
        new Table({
          name: 'producao_etapas_resumo',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'unidade', type: 'varchar', length: '20' },
            { name: 'filial', type: 'integer' },
            { name: 'requisicao', type: 'integer' },
            { name: 'formula', type: 'varchar', length: '10' },
            { name: 'codEtapa', type: 'varchar', length: '20' },
            { name: 'etapa', type: 'varchar', length: '200' },
            { name: 'posicaoEtapa', type: 'integer' },
            { name: 'codFuncEntrada', type: 'integer', isNullable: true },
            { name: 'funcEntrada', type: 'varchar', length: '500', isNullable: true },
            { name: 'codFuncSaida', type: 'integer', isNullable: true },
            { name: 'funcSaida', type: 'varchar', length: '500', isNullable: true },
            { name: 'dataEntrada', type: 'date', isNullable: true },
            { name: 'horaEntrada', type: 'varchar', length: '8', isNullable: true },
            { name: 'dataSaida', type: 'date', isNullable: true },
            { name: 'horaSaida', type: 'varchar', length: '8', isNullable: true },
            { name: 'tempoEtapa', type: 'integer', isNullable: true },
            {
              name: 'formaFarmaceutica',
              type: 'varchar',
              length: '200',
              isNullable: true,
            },
            {
              name: 'quantidade',
              type: 'numeric',
              precision: 15,
              scale: 4,
              isNullable: true,
            },
            {
              name: 'unidadeMedida',
              type: 'varchar',
              length: '20',
              isNullable: true,
            },
            { name: 'laboratorio', type: 'varchar', length: '200', isNullable: true },
            { name: 'tipoFormula', type: 'varchar', length: '200', isNullable: true },
            { name: 'qtdPrincipiosAtivos', type: 'integer', default: 0 },
            { name: 'principiosAtivos', type: 'text', isNullable: true },
            { name: 'embalagem', type: 'varchar', length: '500', isNullable: true },
            { name: 'paciente', type: 'varchar', length: '500', isNullable: true },
            { name: 'cliente', type: 'varchar', length: '500', isNullable: true },
            { name: 'dataRetirada', type: 'date', isNullable: true },
            { name: 'horaRetirada', type: 'varchar', length: '8', isNullable: true },
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
        'producao_etapas_resumo',
        new TableUnique({
          name: 'uq_producao_etapa',
          columnNames: [
            'unidade',
            'filial',
            'requisicao',
            'formula',
            'codEtapa',
          ],
        }),
      );

      await queryRunner.createIndex(
        'producao_etapas_resumo',
        new TableIndex({
          name: 'idx_producao_etapa_unidade_data_entrada',
          columnNames: ['unidade', 'dataEntrada'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('producao_etapas_resumo')) {
      await queryRunner.dropTable('producao_etapas_resumo');
    }
    if (await queryRunner.hasTable('painel_medicos_representantes_historico')) {
      await queryRunner.dropTable('painel_medicos_representantes_historico');
    }
    if (await queryRunner.hasTable('painel_medicos_representantes')) {
      await queryRunner.dropTable('painel_medicos_representantes');
    }

    const configTable = await queryRunner.getTable('sincronizacao_config');
    if (configTable?.findColumnByName('ultimaModificacaoProducaoEtapas')) {
      await queryRunner.dropColumn(
        'sincronizacao_config',
        'ultimaModificacaoProducaoEtapas',
      );
    }
    if (configTable?.findColumnByName('painelContratoRepresentantes')) {
      await queryRunner.dropColumn(
        'sincronizacao_config',
        'painelContratoRepresentantes',
      );
    }
  }
}
