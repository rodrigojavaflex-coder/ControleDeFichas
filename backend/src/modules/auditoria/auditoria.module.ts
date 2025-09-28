import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from '../../common/services/auditoria.service';
import { RollbackService } from '../../common/services/rollback.service';
import { Auditoria } from './entities/auditoria.entity';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { FichaTecnicaModule } from '../ficha-tecnica/ficha-tecnica.module';
import { ConfiguracaoModule } from '../configuracao/configuracao.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Auditoria]),
    forwardRef(() => UsuariosModule),
    forwardRef(() => FichaTecnicaModule),
    forwardRef(() => ConfiguracaoModule),
  ],
  controllers: [AuditoriaController],
  providers: [AuditoriaService, RollbackService],
  exports: [AuditoriaService, RollbackService],
})
export class AuditoriaModule {}
