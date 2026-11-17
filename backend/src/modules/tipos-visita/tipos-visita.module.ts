import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { TipoVisita } from './entities/tipo-visita.entity';
import { TiposVisitaService } from './tipos-visita.service';
import { TiposVisitaController } from './tipos-visita.controller';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([TipoVisita, Usuario]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [TiposVisitaController],
  providers: [TiposVisitaService, PermissionsGuard],
  exports: [TiposVisitaService],
})
export class TiposVisitaModule {}
