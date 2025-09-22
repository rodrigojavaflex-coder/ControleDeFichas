const { Client } = require('pg');

async function createAuditTable() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'metrobus',
    password: 'Ro112543*',
    port: 5432,
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco');

    // Verificar se a tabela já existe
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'audit_logs'
      );
    `);

    if (tableExists.rows[0].exists) {
      console.log('ℹ️ Tabela audit_logs já existe');
      return;
    }

    // Criar enums
    console.log('📝 Criando enums...');
    
    await client.query(`
      CREATE TYPE "audit_level_enum" AS ENUM('info', 'warning', 'error', 'critical')
    `);

    await client.query(`
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

    // Criar tabela
    console.log('🏗️ Criando tabela audit_logs...');
    
    await client.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "action" audit_action_enum NOT NULL,
        "level" audit_level_enum NOT NULL DEFAULT 'info',
        "userId" varchar,
        "entityType" varchar,
        "entityId" varchar,
        "description" text NOT NULL,
        "previousData" jsonb,
        "newData" jsonb,
        "metadata" jsonb,
        "ipAddress" varchar(45),
        "userAgent" text,
        "endpoint" varchar,
        "httpMethod" varchar,
        "httpStatus" integer,
        "executionTime" integer,
        "success" boolean NOT NULL DEFAULT true,
        "errorMessage" text,
        "createdAt" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Criar índices
    console.log('📊 Criando índices...');
    
    await client.query(`
      CREATE INDEX "IDX_AUDIT_ACTION_CREATED_AT" ON "audit_logs" ("action", "createdAt")
    `);

    await client.query(`
      CREATE INDEX "IDX_AUDIT_USER_CREATED_AT" ON "audit_logs" ("userId", "createdAt")
    `);

    await client.query(`
      CREATE INDEX "IDX_AUDIT_ENTITY" ON "audit_logs" ("entityType", "entityId")
    `);

    await client.query(`
      CREATE INDEX "IDX_AUDIT_CREATED_AT" ON "audit_logs" ("createdAt")
    `);

    console.log('✅ Tabela de auditoria criada com sucesso!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

createAuditTable();