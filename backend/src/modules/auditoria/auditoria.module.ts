import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from '../../common/services/auditoria.service';
import { RollbackService } from '../../common/services/rollback.service';
import { Auditoria } from './entities/auditoria.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { FichaTecnicaModule } from '../ficha-tecnica/ficha-tecnica.module';
import { ConfiguracaoModule } from '../configuracao/configuracao.module';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule,
    TypeOrmModule.forFeature([Auditoria, Usuario]),
    forwardRef(() => UsuariosModule),
    forwardRef(() => FichaTecnicaModule),
    forwardRef(() => ConfiguracaoModule),
  ],
  controllers: [AuditoriaController],
  providers: [AuditoriaService, RollbackService, PermissionsGuard],
  exports: [AuditoriaService, RollbackService],
})
export class AuditoriaModule {}
