import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ComercialAcompanhamentoModule } from '../comercial-acompanhamento/comercial-acompanhamento.module';
import { ComercialAnaliseController } from './comercial-analise.controller';
import { ComercialAnaliseService } from './comercial-analise.service';

@Module({
  imports: [
    ComercialAcompanhamentoModule,
    TypeOrmModule.forFeature([Usuario]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [ComercialAnaliseController],
  providers: [ComercialAnaliseService, PermissionsGuard],
})
export class ComercialAnaliseModule {}
