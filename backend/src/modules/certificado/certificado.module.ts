import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { CertificadoService } from './certificado.service';
import { CertificadoController } from './certificado.controller';
import { Certificado } from './entities/certificado.entity';
import { Laudo } from './entities/laudo.entity';
import { LaudoService } from './laudo.service';
import { LaudoController } from './laudo.controller';
import { FichaTecnica } from '../ficha-tecnica/entities/ficha-tecnica.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Certificado, FichaTecnica, Usuario, Laudo]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [CertificadoController, LaudoController],
  providers: [CertificadoService, LaudoService, PermissionsGuard],
  exports: [CertificadoService, LaudoService],
})
export class CertificadoModule {}