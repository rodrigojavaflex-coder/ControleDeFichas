import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TiposPendenciaModule } from '../tipos-pendencia/tipos-pendencia.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { SolicitacaoHistorico } from './entities/solicitacao-historico.entity';
import { Solicitacao } from './entities/solicitacao.entity';
import { SolicitacoesController } from './solicitacoes.controller';
import { SolicitacoesService } from './solicitacoes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Solicitacao, SolicitacaoHistorico, Usuario]),
    TiposPendenciaModule,
    JwtModule,
    ConfigModule,
  ],
  controllers: [SolicitacoesController],
  providers: [SolicitacoesService, PermissionsGuard],
  exports: [SolicitacoesService],
})
export class SolicitacoesModule {}
