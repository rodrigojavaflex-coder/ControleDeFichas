import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('agent.port') ?? 3333;
  const authToken = configService.get<string>('agent.authToken');

  if (!authToken) {
    new Logger('bootstrap').warn('AUTH_TOKEN não configurado; agente recusará requisições.');
  }

  await app.listen(port);
  const url = await app.getUrl();
  new Logger('bootstrap').log(`Agente iniciado em ${url}`);
}

bootstrap();
