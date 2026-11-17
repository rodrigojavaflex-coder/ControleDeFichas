import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { TipoPendencia } from './entities/tipo-pendencia.entity';
import { TiposPendenciaController } from './tipos-pendencia.controller';
import { TiposPendenciaService } from './tipos-pendencia.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TipoPendencia, Usuario]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [TiposPendenciaController],
  providers: [TiposPendenciaService, PermissionsGuard],
  exports: [TiposPendenciaService],
})
export class TiposPendenciaModule {}
