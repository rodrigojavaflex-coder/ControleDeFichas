import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { BaixasService } from './baixas.service';
import { BaixasController } from './baixas.controller';
import { Baixa } from './entities/baixa.entity';
import { Venda } from '../vendas/entities/venda.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { VendasModule } from '../vendas/vendas.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Baixa, Venda, Usuario]),
    JwtModule,
    ConfigModule,
    forwardRef(() => VendasModule),
    forwardRef(() => AuditoriaModule),
  ],
  controllers: [BaixasController],
  providers: [BaixasService, PermissionsGuard],
  exports: [BaixasService],
})
export class BaixasModule {}