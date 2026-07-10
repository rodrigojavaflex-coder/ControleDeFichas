import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { CaixaController } from './caixa.controller';
import { CaixaService } from './caixa.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [CaixaController],
  providers: [CaixaService],
})
export class CaixaModule {}
