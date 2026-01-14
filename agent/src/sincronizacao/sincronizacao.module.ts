import { Module } from '@nestjs/common';
import { SincronizacaoController } from './sincronizacao.controller';
import { SincronizacaoService } from './sincronizacao.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SincronizacaoController],
  providers: [SincronizacaoService],
})
export class SincronizacaoModule {}
