import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from '../../common/services/auditoria.service';
import { Auditoria } from './entities/auditoria.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ConfiguracaoModule } from '../configuracao/configuracao.module';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule,
    TypeOrmModule.forFeature([Auditoria, Usuario]),
    forwardRef(() => ConfiguracaoModule),
  ],
  controllers: [AuditoriaController],
  providers: [AuditoriaService, PermissionsGuard],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}
