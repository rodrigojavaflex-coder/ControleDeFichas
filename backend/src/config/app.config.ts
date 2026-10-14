import { registerAs } from '@nestjs/config';

const parseList = (value?: string, fallback: string[] = []): string[] => {
  if (!value) {
    return fallback;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export default registerAs('app', () => {
  const environment = process.env.NODE_ENV || 'development';
  const defaultOrigins =
    environment === 'production'
      ? []
      : [
          'http://localhost:4200',
          'http://localhost:3000',
          'http://localhost:8100',
          'http://127.0.0.1:8100',
        ];

  const capacitorOrigins = [
    'https://localhost',
    'capacitor://localhost',
    'ionic://localhost',
  ];

  const origins = [
    ...new Set([
      ...parseList(process.env.CORS_ORIGINS, defaultOrigins),
      ...capacitorOrigins,
    ]),
  ];

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    environment,
    jwtSecret: process.env.JWT_SECRET || '',
    cors: {
      origins,
      methods: parseList(process.env.CORS_METHODS, [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'PATCH',
      ]),
      credentials: (process.env.CORS_ALLOW_CREDENTIALS ?? 'true') !== 'false',
    },
    swagger: {
      title: process.env.SWAGGER_TITLE || 'API Documentation',
      description: process.env.SWAGGER_DESCRIPTION || 'API Description',
      version: process.env.SWAGGER_VERSION || '1.0',
    },
  };
});
