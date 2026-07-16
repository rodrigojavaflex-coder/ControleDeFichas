import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ProducaoController } from './producao.controller';
import { ProducaoService } from './producao.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ProducaoController],
  providers: [ProducaoService],
})
export class ProducaoModule {}
