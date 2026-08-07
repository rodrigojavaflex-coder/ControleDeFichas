import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ProducaoEtapaResumo } from '../producao-etapas/entities/producao-etapa-resumo.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ProducaoConfigModule } from '../producao-config/producao-config.module';
import { ProducaoAcompanhamentoService } from './producao-acompanhamento.service';
import { ProducaoAcompanhamentoController } from './producao-acompanhamento.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProducaoEtapaResumo, Usuario, Funcionario]),
    ProducaoConfigModule,
    JwtModule,
    ConfigModule,
  ],
  controllers: [ProducaoAcompanhamentoController],
  providers: [ProducaoAcompanhamentoService, PermissionsGuard],
})
export class ProducaoAcompanhamentoModule {}
