import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SincronizacaoConfig } from './entities/sincronizacao-config.entity';
import { Cliente } from '../clientes/entities/cliente.entity';
import { Prescritor } from '../prescritores/entities/prescritor.entity';
import { SincronizacaoConfigService } from './sincronizacao-config.service';
import { SincronizacaoConfigController } from './sincronizacao-config.controller';
import { SincronizacaoService } from './sincronizacao.service';
import { SincronizacaoController } from './sincronizacao.controller';
import { SincronizacaoSchedulerService } from './sincronizacao-scheduler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SincronizacaoConfig, Cliente, Prescritor]),
    ConfigModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    SincronizacaoConfigController,
    SincronizacaoController,
  ],
  providers: [
    SincronizacaoConfigService,
    SincronizacaoService,
    SincronizacaoSchedulerService,
  ],
  exports: [SincronizacaoConfigService, SincronizacaoService],
})
export class SincronizacaoModule {}
