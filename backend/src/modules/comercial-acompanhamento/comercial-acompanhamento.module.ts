import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ComercialMetaVendedor } from '../comercial-meta/entities/comercial-meta-vendedor.entity';
import { ComercialMetaUnidade } from '../comercial-meta/entities/comercial-meta-unidade.entity';
import { ComercialComissaoFaixa } from '../comercial-meta/entities/comercial-comissao-faixa.entity';
import { ComercialComissaoPolitica } from '../comercial-meta/entities/comercial-comissao-politica.entity';
import { CalendarioUnidade } from '../producao-config/entities/calendario-unidade.entity';
import { ProducaoFeriado } from '../producao-config/entities/producao-feriado.entity';
import { CaixaFechamento } from '../fechamento-caixa/entities/caixa-fechamento.entity';
import { ComercialAcompanhamentoController } from './comercial-acompanhamento.controller';
import { ComercialAcompanhamentoService } from './comercial-acompanhamento.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Funcionario,
      Usuario,
      ComercialMetaVendedor,
      ComercialMetaUnidade,
      ComercialComissaoFaixa,
      ComercialComissaoPolitica,
      CalendarioUnidade,
      ProducaoFeriado,
      CaixaFechamento,
    ]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [ComercialAcompanhamentoController],
  providers: [ComercialAcompanhamentoService, PermissionsGuard],
})
export class ComercialAcompanhamentoModule {}
