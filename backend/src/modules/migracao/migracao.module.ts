import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MigracaoService } from './migracao.service';
import { MigracaoController } from './migracao.controller';
import { FirebirdConnectionService } from './firebird-connection.service';
import { Venda } from '../vendas/entities/venda.entity';
import { Cliente } from '../clientes/entities/cliente.entity';
import { Vendedor } from '../vendedores/entities/vendedor.entity';
import { Prescritor } from '../prescritores/entities/prescritor.entity';
import legacyDatabasesConfig from '../../config/legacy-database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [legacyDatabasesConfig],
    }),
    TypeOrmModule.forFeature([Venda, Cliente, Vendedor, Prescritor]),
  ],
  providers: [MigracaoService, FirebirdConnectionService],
  controllers: [MigracaoController],
})
export class MigracaoModule {}

