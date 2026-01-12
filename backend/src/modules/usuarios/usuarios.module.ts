import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { Usuario } from './entities/usuario.entity';
import { Perfil } from '../perfil/entities/perfil.entity';
import { Vendedor } from '../vendedores/entities/vendedor.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [
  TypeOrmModule.forFeature([Usuario, Perfil, Vendedor]),
    JwtModule,
    ConfigModule,
    forwardRef(() => AuditoriaModule),
  ],
  controllers: [UsuariosController],
  providers: [UsuariosService, PermissionsGuard],
  exports: [UsuariosService, PermissionsGuard],
})
export class UsuariosModule {}
