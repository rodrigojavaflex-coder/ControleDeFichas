import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { VendasController } from './vendas.controller';
import { VendasService } from './vendas.service';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [VendasController],
  providers: [VendasService],
})
export class VendasModule {}
