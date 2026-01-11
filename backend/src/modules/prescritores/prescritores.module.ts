import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PrescritoresService } from './prescritores.service';
import { PrescritoresController } from './prescritores.controller';
import { Prescritor } from './entities/prescritor.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Prescritor, Usuario]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [PrescritoresController],
  providers: [PrescritoresService, PermissionsGuard],
  exports: [PrescritoresService],
})
export class PrescritoresModule {}

