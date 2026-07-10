import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { FechamentoCaixaController } from './fechamento-caixa.controller';
import { FechamentoCaixaService } from './fechamento-caixa.service';
import { CaixaPagamentoErp } from './entities/caixa-pagamento-erp.entity';
import { CaixaItemErp } from './entities/caixa-item-erp.entity';
import { CaixaRequisicaoPaga } from './entities/caixa-requisicao-paga.entity';
import { Orcamento } from '../orcamentos/entities/orcamento.entity';
import { Baixa } from '../baixas/entities/baixa.entity';
import { Cliente } from '../clientes/entities/cliente.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CaixaSaldoInicialUnidade } from './entities/caixa-saldo-inicial-unidade.entity';
import { CaixaFechamento } from './entities/caixa-fechamento.entity';
import { CaixaFechamentoLinha } from './entities/caixa-fechamento-linha.entity';
import { CaixaFechamentoConsolidadoService } from './caixa-fechamento-consolidado.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CaixaPagamentoErp,
      CaixaItemErp,
      CaixaRequisicaoPaga,
      Orcamento,
      Baixa,
      Cliente,
      Usuario,
      CaixaSaldoInicialUnidade,
      CaixaFechamento,
      CaixaFechamentoLinha,
    ]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [FechamentoCaixaController],
  providers: [
    FechamentoCaixaService,
    CaixaFechamentoConsolidadoService,
    PermissionsGuard,
  ],
  exports: [FechamentoCaixaService, CaixaFechamentoConsolidadoService],
})
export class FechamentoCaixaModule {}
