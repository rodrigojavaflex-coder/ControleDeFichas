import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Orcamento } from './entities/orcamento.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Orcamento])],
  exports: [TypeOrmModule],
})
export class OrcamentosModule {}
