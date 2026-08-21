import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { VisitacaoAcompanhamentoController } from './visitacao-acompanhamento.controller';
import { VisitacaoAcompanhamentoService } from './visitacao-acompanhamento.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Funcionario, Usuario]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [VisitacaoAcompanhamentoController],
  providers: [VisitacaoAcompanhamentoService, PermissionsGuard],
})
export class VisitacaoAcompanhamentoModule {}
