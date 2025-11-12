import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { VendasService } from './vendas.service';
import { VendasController } from './vendas.controller';
import { Venda } from './entities/venda.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { BaixasModule } from '../baixas/baixas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Venda, Usuario]),
    JwtModule,
    ConfigModule,
    forwardRef(() => AuditoriaModule),
    forwardRef(() => BaixasModule),
  ],
  controllers: [VendasController],
  providers: [VendasService, PermissionsGuard],
  exports: [VendasService],
})
export class VendasModule {}