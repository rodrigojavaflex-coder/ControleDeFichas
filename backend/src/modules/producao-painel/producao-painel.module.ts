import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ProducaoEtapaResumo } from '../producao-etapas/entities/producao-etapa-resumo.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Prescritor } from '../prescritores/entities/prescritor.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ProducaoConfigModule } from '../producao-config/producao-config.module';
import { ProducaoPainelService } from './producao-painel.service';
import { ProducaoPainelController } from './producao-painel.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProducaoEtapaResumo, Usuario, Funcionario, Prescritor]),
    ProducaoConfigModule,
    JwtModule,
    ConfigModule,
  ],
  controllers: [ProducaoPainelController],
  providers: [ProducaoPainelService, PermissionsGuard],
})
export class ProducaoPainelModule {}
