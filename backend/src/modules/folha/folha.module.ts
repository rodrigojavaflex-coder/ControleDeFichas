import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Funcionario } from './entities/funcionario.entity';
import { FolhaTipo } from './entities/folha-tipo.entity';
import { FolhaCargo } from './entities/folha-cargo.entity';
import { FolhaSetor } from './entities/folha-setor.entity';
import { FolhaVerba } from './entities/folha-verba.entity';
import { FolhaFechamento } from './entities/folha-fechamento.entity';
import { FolhaCapa } from './entities/folha-capa.entity';
import { FolhaItem } from './entities/folha-item.entity';
import { FolhaFuncionarioEventoFixo } from './entities/folha-funcionario-evento-fixo.entity';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { FolhaFuncionariosService } from './folha-funcionarios.service';
import { FolhaVerbasService } from './folha-verbas.service';
import { FolhaTiposService } from './folha-tipos.service';
import { FolhaFechamentoService } from './folha-fechamento.service';
import { FolhaCapasService } from './folha-capas.service';
import { FolhaFuncionariosController } from './folha-funcionarios.controller';
import { FolhaCargosService } from './folha-cargos.service';
import { FolhaSetoresService } from './folha-setores.service';
import { FolhaVerbasController } from './folha-verbas.controller';
import { FolhaCargosController } from './folha-cargos.controller';
import { FolhaSetoresController } from './folha-setores.controller';
import { FolhaTiposController } from './folha-tipos.controller';
import { FolhaCapasController } from './folha-capas.controller';
import { FolhaFechamentoController } from './folha-fechamento.controller';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { FolhaReciboWhatsappService } from '../whatsapp/folha-recibo-whatsapp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Funcionario,
      FolhaTipo,
      FolhaCargo,
      FolhaSetor,
      FolhaVerba,
      FolhaFechamento,
      FolhaCapa,
      FolhaItem,
      Usuario,
      FolhaFuncionarioEventoFixo,
    ]),
    JwtModule,
    ConfigModule,
    AuditoriaModule,
    WhatsappModule,
  ],
  controllers: [
    FolhaFuncionariosController,
    FolhaCargosController,
    FolhaSetoresController,
    FolhaVerbasController,
    FolhaTiposController,
    FolhaCapasController,
    FolhaFechamentoController,
  ],
  providers: [
    FolhaFuncionariosService,
    FolhaCargosService,
    FolhaSetoresService,
    FolhaVerbasService,
    FolhaTiposService,
    FolhaFechamentoService,
    FolhaCapasService,
    FolhaReciboWhatsappService,
    PermissionsGuard,
  ],
  exports: [
    FolhaFuncionariosService,
    FolhaCargosService,
    FolhaSetoresService,
    FolhaVerbasService,
    FolhaTiposService,
    FolhaCapasService,
    FolhaFechamentoService,
  ],
})
export class FolhaModule {}
