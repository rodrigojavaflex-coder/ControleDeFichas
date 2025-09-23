import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Configuracao } from './configuracao.entity';
import { ConfiguracaoService } from './configuracao.service';
import { ConfiguracaoController } from './configuracao.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Configuracao])],
  providers: [ConfiguracaoService],
  controllers: [ConfiguracaoController],
  exports: [ConfiguracaoService]
})
export class ConfiguracaoModule {}
