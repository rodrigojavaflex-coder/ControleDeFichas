import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProducaoCertificadoAnalise } from './entities/producao-certificado-analise.entity';
import { ProducaoCertificadosService } from './producao-certificados.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProducaoCertificadoAnalise])],
  providers: [ProducaoCertificadosService],
  exports: [ProducaoCertificadosService],
})
export class ProducaoCertificadosModule {}
