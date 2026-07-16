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
import { PainelMedicoRepresentante } from '../painel-medicos/entities/painel-medico-representante.entity';
import { PainelMedicoRepresentanteHistorico } from '../painel-medicos/entities/painel-medico-representante-historico.entity';
import { ProducaoEtapaResumo } from '../producao-etapas/entities/producao-etapa-resumo.entity';
import { SincronizacaoConfigService } from './sincronizacao-config.service';
import { SincronizacaoConfigController } from './sincronizacao-config.controller';
import { SincronizacaoService } from './sincronizacao.service';
import { SincronizacaoController } from './sincronizacao.controller';
import { SincronizacaoSchedulerService } from './sincronizacao-scheduler.service';
import { PainelMedicosService } from '../painel-medicos/painel-medicos.service';
import { ProducaoEtapasService } from '../producao-etapas/producao-etapas.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SincronizacaoConfig,
      Cliente,
      Prescritor,
      Orcamento,
      Usuario,
      PainelMedicoRepresentante,
      PainelMedicoRepresentanteHistorico,
      ProducaoEtapaResumo,
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
    PainelMedicosService,
    ProducaoEtapasService,
    PermissionsGuard,
  ],
  exports: [SincronizacaoConfigService, SincronizacaoService],
})
export class SincronizacaoModule {}
