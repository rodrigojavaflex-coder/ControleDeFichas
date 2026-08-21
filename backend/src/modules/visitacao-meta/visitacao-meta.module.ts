import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { VisitacaoMetaRepresentante } from './entities/visitacao-meta-representante.entity';
import { VisitacaoComissaoFaixa } from './entities/visitacao-comissao-faixa.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { VisitacaoMetaService } from './visitacao-meta.service';
import { VisitacaoMetaController } from './visitacao-meta.controller';
import { VisitacaoComissaoController } from './visitacao-comissao.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VisitacaoMetaRepresentante,
      VisitacaoComissaoFaixa,
      Funcionario,
      Usuario,
    ]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [VisitacaoMetaController, VisitacaoComissaoController],
  providers: [VisitacaoMetaService, PermissionsGuard],
})
export class VisitacaoMetaModule {}
