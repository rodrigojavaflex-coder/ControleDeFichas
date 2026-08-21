import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ProducaoEtapaRemuneracao } from './entities/producao-etapa-remuneracao.entity';
import { ProducaoFuncionarioEtapa } from './entities/producao-funcionario-etapa.entity';
import { ProducaoJornadaUnidade } from './entities/producao-jornada-unidade.entity';
import { ProducaoJornadaIntervalo } from './entities/producao-jornada-intervalo.entity';
import { ProducaoJornadaDia } from './entities/producao-jornada-dia.entity';
import { ProducaoFeriado } from './entities/producao-feriado.entity';
import { CalendarioUnidade } from './entities/calendario-unidade.entity';
import { ProducaoPainelEtapaFinal } from './entities/producao-painel-etapa-final.entity';
import { ProducaoPainelAlertaRetirada } from './entities/producao-painel-alerta-retirada.entity';
import { ProducaoEtapaResumo } from '../producao-etapas/entities/producao-etapa-resumo.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ProducaoConfigService } from './producao-config.service';
import { ProducaoCalendarioService } from './producao-calendario.service';
import { ProducaoCalendarioCacheService } from './producao-calendario-cache.service';
import { ProducaoPainelRetiradaConfigService } from './producao-painel-retirada-config.service';
import { ProducaoConfigController } from './producao-config.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProducaoEtapaRemuneracao,
      ProducaoFuncionarioEtapa,
      ProducaoJornadaUnidade,
      ProducaoJornadaIntervalo,
      ProducaoJornadaDia,
      ProducaoFeriado,
      CalendarioUnidade,
      ProducaoPainelEtapaFinal,
      ProducaoPainelAlertaRetirada,
      ProducaoEtapaResumo,
      Funcionario,
      Usuario,
    ]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [ProducaoConfigController],
  providers: [
    ProducaoConfigService,
    ProducaoCalendarioService,
    ProducaoCalendarioCacheService,
    ProducaoPainelRetiradaConfigService,
    PermissionsGuard,
  ],
  exports: [
    ProducaoConfigService,
    ProducaoCalendarioService,
    ProducaoCalendarioCacheService,
    ProducaoPainelRetiradaConfigService,
  ],
})
export class ProducaoConfigModule {}
