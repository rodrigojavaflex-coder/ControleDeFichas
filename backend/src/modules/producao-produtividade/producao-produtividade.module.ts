import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ProducaoEtapaResumo } from '../producao-etapas/entities/producao-etapa-resumo.entity';
import { ProducaoEtapaRemuneracao } from '../producao-config/entities/producao-etapa-remuneracao.entity';
import { ProducaoFuncionarioEtapa } from '../producao-config/entities/producao-funcionario-etapa.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ProducaoProdutividadeService } from './producao-produtividade.service';
import { ProducaoProdutividadeController } from './producao-produtividade.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProducaoEtapaResumo,
      ProducaoEtapaRemuneracao,
      ProducaoFuncionarioEtapa,
      Funcionario,
      Usuario,
    ]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [ProducaoProdutividadeController],
  providers: [ProducaoProdutividadeService, PermissionsGuard],
})
export class ProducaoProdutividadeModule {}
