import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableCheck,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Retrato mensal da visitação por unidade (RN-VIS-013).
 * Sem alteração em perfil.permissoes.
 */
export class VisitacaoFechamento1750540000000 implements MigrationInterface {
  name = 'VisitacaoFechamento1750540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('visitacao_fechamento'))) {
      await queryRunner.createTable(
        new Table({
          name: 'visitacao_fechamento',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'unidade', type: 'varchar', length: '32' },
            { name: 'ano', type: 'int' },
            { name: 'mes', type: 'int' },
            {
              name: 'status',
              type: 'varchar',
              length: '20',
              default: `'FECHADO'`,
            },
            { name: 'data_ultimo_dia_util', type: 'date' },
            {
              name: 'recebido_loja',
              type: 'numeric',
              precision: 14,
              scale: 2,
              default: 0,
            },
            {
              name: 'rejeitado_loja',
              type: 'numeric',
              precision: 14,
              scale: 2,
              default: 0,
            },
            { name: 'fechado_em', type: 'timestamp' },
            { name: 'fechado_por_id', type: 'uuid', isNullable: true },
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
        'visitacao_fechamento',
        new TableIndex({
          name: 'uq_visitacao_fechamento_unidade_ano_mes',
          columnNames: ['unidade', 'ano', 'mes'],
          isUnique: true,
        }),
      );
      await queryRunner.createCheckConstraint(
        'visitacao_fechamento',
        new TableCheck({
          name: 'chk_visitacao_fechamento_mes',
          expression: 'mes >= 1 AND mes <= 12',
        }),
      );
      await queryRunner.createForeignKey(
        'visitacao_fechamento',
        new TableForeignKey({
          name: 'fk_visitacao_fechamento_usuario',
          columnNames: ['fechado_por_id'],
          referencedTableName: 'usuarios',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }

    if (!(await queryRunner.hasTable('visitacao_fechamento_carteira'))) {
      await queryRunner.createTable(
        new Table({
          name: 'visitacao_fechamento_carteira',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'fechamento_id', type: 'uuid' },
            { name: 'funcionario_id', type: 'uuid', isNullable: true },
            { name: 'crm_medico', type: 'varchar', length: '20' },
            { name: 'uf_crm_medico', type: 'varchar', length: '2' },
            { name: 'nome_medico', type: 'varchar', length: '500' },
            { name: 'contrato_representante', type: 'integer' },
            { name: 'codigo_representante', type: 'integer' },
            { name: 'nome_representante', type: 'varchar', length: '500' },
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
        'visitacao_fechamento_carteira',
        new TableIndex({
          name: 'idx_visitacao_fech_carteira_fechamento',
          columnNames: ['fechamento_id'],
        }),
      );
      await queryRunner.createIndex(
        'visitacao_fechamento_carteira',
        new TableIndex({
          name: 'uq_visitacao_fech_carteira_crm_rep',
          columnNames: [
            'fechamento_id',
            'crm_medico',
            'uf_crm_medico',
            'contrato_representante',
            'codigo_representante',
          ],
          isUnique: true,
        }),
      );
      await queryRunner.createForeignKey(
        'visitacao_fechamento_carteira',
        new TableForeignKey({
          name: 'fk_visitacao_fech_carteira_fechamento',
          columnNames: ['fechamento_id'],
          referencedTableName: 'visitacao_fechamento',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
      await queryRunner.createForeignKey(
        'visitacao_fechamento_carteira',
        new TableForeignKey({
          name: 'fk_visitacao_fech_carteira_funcionario',
          columnNames: ['funcionario_id'],
          referencedTableName: 'funcionarios',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }

    if (!(await queryRunner.hasTable('visitacao_fechamento_representante'))) {
      await queryRunner.createTable(
        new Table({
          name: 'visitacao_fechamento_representante',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'fechamento_id', type: 'uuid' },
            { name: 'funcionario_id', type: 'uuid' },
            { name: 'nome_representante', type: 'varchar', length: '200' },
            { name: 'contrato_representante', type: 'integer' },
            { name: 'codigo_representante', type: 'integer' },
            {
              name: 'recebido_loja',
              type: 'numeric',
              precision: 14,
              scale: 2,
              default: 0,
            },
            {
              name: 'rejeitado_loja',
              type: 'numeric',
              precision: 14,
              scale: 2,
              default: 0,
            },
            {
              name: 'representatividade',
              type: 'numeric',
              precision: 9,
              scale: 4,
              isNullable: true,
            },
            {
              name: 'valor_meta',
              type: 'numeric',
              precision: 14,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'percentual_meta',
              type: 'numeric',
              precision: 9,
              scale: 4,
              isNullable: true,
            },
            {
              name: 'percentual_faixa',
              type: 'numeric',
              precision: 9,
              scale: 4,
              isNullable: true,
            },
            {
              name: 'valor_comissao',
              type: 'numeric',
              precision: 14,
              scale: 2,
              isNullable: true,
            },
            { name: 'qtd_com_movimento', type: 'int', default: 0 },
            { name: 'qtd_ativos_painel', type: 'int', default: 0 },
            { name: 'qtd_fora_atendimento', type: 'int', default: 0 },
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
        'visitacao_fechamento_representante',
        new TableIndex({
          name: 'idx_visitacao_fech_rep_fechamento',
          columnNames: ['fechamento_id'],
        }),
      );
      await queryRunner.createIndex(
        'visitacao_fechamento_representante',
        new TableIndex({
          name: 'uq_visitacao_fech_rep_funcionario',
          columnNames: ['fechamento_id', 'funcionario_id'],
          isUnique: true,
        }),
      );
      await queryRunner.createForeignKey(
        'visitacao_fechamento_representante',
        new TableForeignKey({
          name: 'fk_visitacao_fech_rep_fechamento',
          columnNames: ['fechamento_id'],
          referencedTableName: 'visitacao_fechamento',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
      await queryRunner.createForeignKey(
        'visitacao_fechamento_representante',
        new TableForeignKey({
          name: 'fk_visitacao_fech_rep_funcionario',
          columnNames: ['funcionario_id'],
          referencedTableName: 'funcionarios',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
        }),
      );
    }

    if (!(await queryRunner.hasTable('visitacao_fechamento_medico'))) {
      await queryRunner.createTable(
        new Table({
          name: 'visitacao_fechamento_medico',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'fechamento_id', type: 'uuid' },
            { name: 'funcionario_id', type: 'uuid', isNullable: true },
            { name: 'crm_medico', type: 'varchar', length: '20' },
            { name: 'uf_crm_medico', type: 'varchar', length: '2' },
            { name: 'nome_medico', type: 'varchar', length: '500' },
            {
              name: 'recebido_loja',
              type: 'numeric',
              precision: 14,
              scale: 2,
              default: 0,
            },
            {
              name: 'rejeitado_loja',
              type: 'numeric',
              precision: 14,
              scale: 2,
              default: 0,
            },
            { name: 'na_carteira', type: 'boolean', default: false },
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
        'visitacao_fechamento_medico',
        new TableIndex({
          name: 'idx_visitacao_fech_medico_fechamento',
          columnNames: ['fechamento_id'],
        }),
      );
      await queryRunner.createIndex(
        'visitacao_fechamento_medico',
        new TableIndex({
          name: 'uq_visitacao_fech_medico_crm',
          columnNames: ['fechamento_id', 'crm_medico', 'uf_crm_medico'],
          isUnique: true,
        }),
      );
      await queryRunner.createForeignKey(
        'visitacao_fechamento_medico',
        new TableForeignKey({
          name: 'fk_visitacao_fech_medico_fechamento',
          columnNames: ['fechamento_id'],
          referencedTableName: 'visitacao_fechamento',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );
      await queryRunner.createForeignKey(
        'visitacao_fechamento_medico',
        new TableForeignKey({
          name: 'fk_visitacao_fech_medico_funcionario',
          columnNames: ['funcionario_id'],
          referencedTableName: 'funcionarios',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('visitacao_fechamento_medico')) {
      await queryRunner.dropTable('visitacao_fechamento_medico', true);
    }
    if (await queryRunner.hasTable('visitacao_fechamento_representante')) {
      await queryRunner.dropTable('visitacao_fechamento_representante', true);
    }
    if (await queryRunner.hasTable('visitacao_fechamento_carteira')) {
      await queryRunner.dropTable('visitacao_fechamento_carteira', true);
    }
    if (await queryRunner.hasTable('visitacao_fechamento')) {
      await queryRunner.dropTable('visitacao_fechamento', true);
    }
  }
}
