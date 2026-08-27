import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { ComercialMetaVendedor } from './entities/comercial-meta-vendedor.entity';
import { ComercialMetaUnidade } from './entities/comercial-meta-unidade.entity';
import { ComercialComissaoFaixa } from './entities/comercial-comissao-faixa.entity';
import { ComercialComissaoPolitica } from './entities/comercial-comissao-politica.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ComercialMetaService } from './comercial-meta.service';
import { ComercialMetaController } from './comercial-meta.controller';
import { ComercialComissaoController } from './comercial-comissao.controller';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ComercialMetaVendedor,
      ComercialMetaUnidade,
      ComercialComissaoFaixa,
      ComercialComissaoPolitica,
      Funcionario,
      Usuario,
    ]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [ComercialMetaController, ComercialComissaoController],
  providers: [ComercialMetaService, PermissionsGuard],
  exports: [ComercialMetaService],
})
export class ComercialMetaModule {}
