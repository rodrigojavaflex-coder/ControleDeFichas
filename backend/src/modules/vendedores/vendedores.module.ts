import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { VendedoresService } from './vendedores.service';
import { VendedoresController } from './vendedores.controller';
import { Vendedor } from './entities/vendedor.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vendedor, Usuario]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [VendedoresController],
  providers: [VendedoresService, PermissionsGuard],
  exports: [VendedoresService],
})
export class VendedoresModule {}

