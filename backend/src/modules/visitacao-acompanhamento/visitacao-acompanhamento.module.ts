import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { VisitacaoMetaRepresentante } from '../visitacao-meta/entities/visitacao-meta-representante.entity';
import { VisitacaoComissaoFaixa } from '../visitacao-meta/entities/visitacao-comissao-faixa.entity';
import { CalendarioUnidade } from '../producao-config/entities/calendario-unidade.entity';
import { ProducaoFeriado } from '../producao-config/entities/producao-feriado.entity';
import { CaixaFechamento } from '../fechamento-caixa/entities/caixa-fechamento.entity';
import { VisitacaoAcompanhamentoController } from './visitacao-acompanhamento.controller';
import { VisitacaoAcompanhamentoService } from './visitacao-acompanhamento.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Funcionario,
      Usuario,
      VisitacaoMetaRepresentante,
      VisitacaoComissaoFaixa,
      CalendarioUnidade,
      ProducaoFeriado,
      CaixaFechamento,
    ]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [VisitacaoAcompanhamentoController],
  providers: [VisitacaoAcompanhamentoService, PermissionsGuard],
})
export class VisitacaoAcompanhamentoModule {}
