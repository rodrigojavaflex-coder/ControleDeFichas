import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TipoVisita } from '../tipos-visita/entities/tipo-visita.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Visita } from './entities/visita.entity';
import { VisitaAgendamento } from './entities/visita-agendamento.entity';
import { VisitaMidia } from './entities/visita-midia.entity';
import { VisitasController } from './visitas.controller';
import { VisitasMidiaController } from './visitas-midia.controller';
import { VisitasMidiaService } from './visitas-midia.service';
import { SolicitacoesModule } from '../solicitacoes/solicitacoes.module';
import { VisitasService } from './visitas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Visita,
      VisitaAgendamento,
      VisitaMidia,
      Usuario,
      TipoVisita,
    ]),
    SolicitacoesModule,
    JwtModule,
    ConfigModule,
  ],
  controllers: [VisitasController, VisitasMidiaController],
  providers: [VisitasService, VisitasMidiaService, PermissionsGuard],
})
export class VisitasModule {}
