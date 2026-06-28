import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { Orcamento } from './entities/orcamento.entity';
import { OrcamentoMotivoRejeicao } from './entities/orcamento-motivo-rejeicao.entity';
import { OrcamentoMotivosRejeicaoController } from './orcamento-motivos-rejeicao.controller';
import { OrcamentoMotivosRejeicaoService } from './orcamento-motivos-rejeicao.service';
import { OrcamentosController } from './orcamentos.controller';
import { OrcamentosRejeitadosController } from './orcamentos-rejeitados.controller';
import { OrcamentosDashboardController } from './orcamentos-dashboard.controller';
import { OrcamentosService } from './orcamentos.service';
import { OrcamentosDashboardService } from './orcamentos-dashboard.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Orcamento, OrcamentoMotivoRejeicao, Usuario]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [
    OrcamentoMotivosRejeicaoController,
    OrcamentosController,
    OrcamentosRejeitadosController,
    OrcamentosDashboardController,
  ],
  providers: [
    OrcamentoMotivosRejeicaoService,
    OrcamentosService,
    OrcamentosDashboardService,
    PermissionsGuard,
  ],
  exports: [TypeOrmModule],
})
export class OrcamentosModule {}
