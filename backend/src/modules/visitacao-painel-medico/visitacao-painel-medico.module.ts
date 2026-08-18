import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { PainelMedicoRepresentante } from '../painel-medicos/entities/painel-medico-representante.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { VisitacaoPainelMedicoController } from './visitacao-painel-medico.controller';
import { VisitacaoPainelMedicoService } from './visitacao-painel-medico.service';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PainelMedicoRepresentante,
      Funcionario,
      Usuario,
    ]),
    JwtModule,
    ConfigModule,
  ],
  controllers: [VisitacaoPainelMedicoController],
  providers: [VisitacaoPainelMedicoService, PermissionsGuard],
})
export class VisitacaoPainelMedicoModule {}
