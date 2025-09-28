import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { FichaTecnicaService } from './ficha-tecnica.service';
import { FichaTecnicaController } from './ficha-tecnica.controller';
import { FichaTecnica } from './entities/ficha-tecnica.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FichaTecnica, Usuario]),
    JwtModule,
    ConfigModule,
    forwardRef(() => AuditoriaModule),
  ],
  controllers: [FichaTecnicaController],
  providers: [FichaTecnicaService, PermissionsGuard],
  exports: [FichaTecnicaService],
})
export class FichaTecnicaModule {}
