import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SincronizacaoConfig } from './entities/sincronizacao-config.entity';
import { Cliente } from '../clientes/entities/cliente.entity';
import { Prescritor } from '../prescritores/entities/prescritor.entity';
import { Orcamento } from '../orcamentos/entities/orcamento.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { SincronizacaoConfigService } from './sincronizacao-config.service';
import { SincronizacaoConfigController } from './sincronizacao-config.controller';
import { SincronizacaoService } from './sincronizacao.service';
import { SincronizacaoController } from './sincronizacao.controller';
import { SincronizacaoSchedulerService } from './sincronizacao-scheduler.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SincronizacaoConfig,
      Cliente,
      Prescritor,
      Orcamento,
      Usuario,
    ]),
    JwtModule,
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
    PermissionsGuard,
  ],
  exports: [SincronizacaoConfigService, SincronizacaoService],
})
export class SincronizacaoModule {}
