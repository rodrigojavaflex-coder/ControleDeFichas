import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  type: 'postgres' as const,
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'metrobus',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize:
    process.env.DATABASE_SYNCHRONIZE === 'true' ||
    (process.env.NODE_ENV !== 'production' &&
      process.env.DATABASE_SYNCHRONIZE !== 'false'),
  // Configuração de logging otimizada
  logging: process.env.DATABASE_LOGGING === 'true' ? true : ['error', 'warn'],
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
  timezone: 'UTC',
  // ✅ Configurações adicionais para produção
  connectTimeoutMS: 60000,
  acquireTimeoutMS: 60000,
  timeout: 60000,
  // Pico de RAM no Postgres: no máximo 5 sessões e work_mem baixo em cada uma.
  // extra é aplicado depois de poolSize no driver; não repetir `max` aqui.
  poolSize: 5,
  extra: {
    options: '-c work_mem=4MB',
  },
}));
