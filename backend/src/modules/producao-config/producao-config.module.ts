import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ProducaoEtapaRemuneracao } from './entities/producao-etapa-remuneracao.entity';
import { ProducaoFuncionarioEtapa } from './entities/producao-funcionario-etapa.entity';
import { ProducaoEtapaResumo } from '../producao-etapas/entities/producao-etapa-resumo.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ProducaoConfigService } from './producao-config.service';
import { ProducaoConfigController } from './producao-config.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProducaoEtapaRemuneracao,
      ProducaoFuncionarioEtapa,
      ProducaoEtapaResumo,
      Funcionario,
      Usuario,
    ]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [ProducaoConfigController],
  providers: [ProducaoConfigService, PermissionsGuard],
  exports: [ProducaoConfigService],
})
export class ProducaoConfigModule {}
