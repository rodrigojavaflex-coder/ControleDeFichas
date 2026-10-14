import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Configuracao } from './entities/configuracao.entity';
import { ConfiguracaoService } from './configuracao.service';
import { ConfiguracaoController } from './configuracao.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { MobileAppVersionGuard } from '../../common/guards/mobile-app-version.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Configuracao]),
    forwardRef(() => AuditoriaModule),
  ],
  providers: [
    ConfiguracaoService,
    MobileAppVersionGuard,
    {
      provide: APP_GUARD,
      useExisting: MobileAppVersionGuard,
    },
  ],
  controllers: [ConfiguracaoController],
  exports: [ConfiguracaoService, TypeOrmModule, MobileAppVersionGuard],
})
export class ConfiguracaoModule {}
