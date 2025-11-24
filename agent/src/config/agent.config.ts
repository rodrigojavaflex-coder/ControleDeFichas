import { registerAs } from '@nestjs/config';
import { AgentConfig } from './config.types';

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default registerAs('agent', (): AgentConfig => {
  const port = parseNumber(process.env.AGENT_PORT ?? process.env.PORT, 3333);
  const dbPort = parseNumber(process.env.DB_PORT, 3050);

  return {
    port,
    authToken: process.env.AUTH_TOKEN ?? '',
    db: {
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: dbPort,
      path: process.env.DB_PATH ?? '',
      user: process.env.DB_USER ?? '',
      password: process.env.DB_PASSWORD ?? '',
      role: process.env.DB_ROLE,
      charset: process.env.DB_CHARSET ?? 'UTF8',
    },
  };
});
