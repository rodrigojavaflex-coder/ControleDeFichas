import { registerAs } from '@nestjs/config';
import { AgentConfig } from './config.types';

const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseList = (value?: string): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export default registerAs('agent', (): AgentConfig => {
  const port = parseNumber(process.env.AGENT_PORT ?? process.env.PORT, 3333);
  const dbPort = parseNumber(process.env.DB_PORT, 3050);
  const rateLimitTtl = parseNumber(
    process.env.AGENT_RATE_LIMIT_TTL,
    60,
  );
  const rateLimitLimit = parseNumber(
    process.env.AGENT_RATE_LIMIT_LIMIT,
    30,
  );

  return {
    port,
    authToken: process.env.AUTH_TOKEN ?? '',
    authTokenFallbacks: parseList(process.env.AUTH_TOKEN_FALLBACKS),
    allowedIps: parseList(process.env.AGENT_ALLOWED_IPS),
    rateLimit: {
      ttl: rateLimitTtl,
      limit: rateLimitLimit,
    },
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
