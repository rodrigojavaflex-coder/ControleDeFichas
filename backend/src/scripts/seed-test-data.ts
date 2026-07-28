import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';

async function seedTestData() {
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    // Script de seed — implementar cenários de teste conforme necessário
    console.log('seed-test-data: nenhuma carga configurada.');
  } finally {
    await app.close();
  }
}

void seedTestData();
