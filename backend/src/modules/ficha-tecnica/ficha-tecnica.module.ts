import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { FichaTecnicaService } from './ficha-tecnica.service';
import { FichaTecnicaController } from './ficha-tecnica.controller';
import { FichaTecnica } from './entities/ficha-tecnica.entity';
import { User } from '../users/entities/user.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FichaTecnica, User]),
    JwtModule,
    ConfigModule,
    AuditModule,
  ],
  controllers: [FichaTecnicaController],
  providers: [FichaTecnicaService, PermissionsGuard],
  exports: [FichaTecnicaService],
})
export class FichaTecnicaModule {}