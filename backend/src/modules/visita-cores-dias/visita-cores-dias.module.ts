import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { VisitaCorDia } from './entities/visita-cor-dia.entity';
import { VisitaCoresDiasController } from './visita-cores-dias.controller';
import { VisitaCoresDiasService } from './visita-cores-dias.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VisitaCorDia, Usuario]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [VisitaCoresDiasController],
  providers: [VisitaCoresDiasService, PermissionsGuard],
  exports: [VisitaCoresDiasService],
})
export class VisitaCoresDiasModule {}
