import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAuditLogTable1732301000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Criar enum para níveis de auditoria
    await queryRunner.query(`
      CREATE TYPE "audit_level_enum" AS ENUM('info', 'warning', 'error', 'critical')
    `);

    // Criar enum para ações de auditoria
    await queryRunner.query(`
      CREATE TYPE "audit_action_enum" AS ENUM(
        'auth:login',
        'auth:logout',
        'auth:login_failed',
        'user:create',
        'user:read',
        'user:update',
        'user:delete',
        'user:print',
        'system:access',
        'system:config_change',
        'report:generate',
        'report:export',
        'permission:grant',
        'permission:revoke',
        'data:sensitive_access',
        'data:bulk_operation'
      )
    `);

    // Criar tabela audit_logs
    await queryRunner.createTable(
      new Table({
        name: 'audit_logs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'action',
            type: 'audit_action_enum',
            comment: 'Ação executada que gerou o log de auditoria',
          },
          {
            name: 'level',
            type: 'audit_level_enum',
            default: "'info'",
            comment: 'Nível de severidade do evento',
          },
          {
            name: 'userId',
            type: 'varchar',
            isNullable: true,
            comment: 'ID do usuário que executou a ação',
          },
          {
            name: 'entityType',
            type: 'varchar',
            isNullable: true,
            comment: 'Tipo da entidade afetada (ex: User, Report)',
          },
          {
            name: 'entityId',
            type: 'varchar',
            isNullable: true,
            comment: 'ID da entidade afetada',
          },
          {
            name: 'description',
            type: 'text',
            comment: 'Descrição detalhada da ação executada',
          },
          {
            name: 'previousData',
            type: 'jsonb',
            isNullable: true,
            comment: 'Dados antes da alteração (para operações de UPDATE/DELETE)',
          },
          {
            name: 'newData',
            type: 'jsonb',
            isNullable: true,
            comment: 'Novos dados após a alteração (para operações de CREATE/UPDATE)',
          },
          {
            name: 'metadata',
            type: 'jsonb',
            isNullable: true,
            comment: 'Metadados adicionais sobre a operação',
          },
          {
            name: 'ipAddress',
            type: 'varchar',
            length: '45',
            isNullable: true,
            comment: 'Endereço IP de onde partiu a ação',
          },
          {
            name: 'userAgent',
            type: 'text',
            isNullable: true,
            comment: 'User-Agent do cliente',
          },
          {
            name: 'endpoint',
            type: 'varchar',
            isNullable: true,
            comment: 'Endpoint/rota acessada',
          },
          {
            name: 'httpMethod',
            type: 'varchar',
            isNullable: true,
            comment: 'Método HTTP utilizado',
          },
          {
            name: 'httpStatus',
            type: 'integer',
            isNullable: true,
            comment: 'Código de status HTTP da resposta',
          },
          {
            name: 'executionTime',
            type: 'integer',
            isNullable: true,
            comment: 'Tempo de execução da operação em milissegundos',
          },
          {
            name: 'success',
            type: 'boolean',
            default: true,
            comment: 'Indica se a operação foi bem-sucedida',
          },
          {
            name: 'errorMessage',
            type: 'text',
            isNullable: true,
            comment: 'Mensagem de erro, se houver',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            comment: 'Data e hora da criação do log',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['userId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
      true,
    );

    // Criar índices para otimizar consultas
    await queryRunner.createIndex('audit_logs', new TableIndex({
      name: 'IDX_AUDIT_ACTION_CREATED_AT',
      columnNames: ['action', 'createdAt']
    }));

    await queryRunner.createIndex('audit_logs', new TableIndex({
      name: 'IDX_AUDIT_USER_CREATED_AT',
      columnNames: ['userId', 'createdAt']
    }));

    await queryRunner.createIndex('audit_logs', new TableIndex({
      name: 'IDX_AUDIT_ENTITY',
      columnNames: ['entityType', 'entityId']
    }));

    await queryRunner.createIndex('audit_logs', new TableIndex({
      name: 'IDX_AUDIT_CREATED_AT',
      columnNames: ['createdAt']
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover índices
    await queryRunner.dropIndex('audit_logs', 'IDX_AUDIT_ACTION_CREATED_AT');
    await queryRunner.dropIndex('audit_logs', 'IDX_AUDIT_USER_CREATED_AT');
    await queryRunner.dropIndex('audit_logs', 'IDX_AUDIT_ENTITY');
    await queryRunner.dropIndex('audit_logs', 'IDX_AUDIT_CREATED_AT');

    // Remover tabela
    await queryRunner.dropTable('audit_logs');

    // Remover enums
    await queryRunner.query(`DROP TYPE "audit_action_enum"`);
    await queryRunner.query(`DROP TYPE "audit_level_enum"`);
  }
}