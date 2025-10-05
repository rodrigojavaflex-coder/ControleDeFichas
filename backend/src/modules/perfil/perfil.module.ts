import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { PerfilService } from './perfil.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PerfilController } from './perfil.controller';
import { Perfil } from './entities/perfil.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Perfil, Usuario]),
    // Importar AuthModule para disponibilizar JwtService e exportar JwtModule
    AuthModule,
    // Importar UsuariosModule para disponibilizar PermissionsGuard e UsuarioRepository
    UsuariosModule,
  ],
  providers: [PerfilService, PermissionsGuard],
  controllers: [PerfilController],
  exports: [PerfilService],
})
export class PerfilModule {}