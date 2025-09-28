import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Configuracao } from './entities/configuracao.entity';
import { ConfiguracaoService } from './configuracao.service';
import { ConfiguracaoController } from './configuracao.controller';
import { AuditoriaModule } from '../auditoria/auditoria.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Configuracao]),
    forwardRef(() => AuditoriaModule),
  ],
  providers: [ConfiguracaoService],
  controllers: [ConfiguracaoController],
  exports: [ConfiguracaoService, TypeOrmModule],
})
export class ConfiguracaoModule {}
