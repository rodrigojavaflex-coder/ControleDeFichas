import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { VisitacaoPainelMedicoService } from './visitacao-painel-medico.service';
import { FindVisitacaoPainelMedicoDto } from './dto/find-visitacao-painel-medico.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { VisitacaoPainelMedicoItemDto } from './dto/visitacao-painel-medico-item.dto';
import { VisitacaoPainelMedicoRepresentanteDto } from './dto/visitacao-painel-medico-representante.dto';
import { Unidade } from '../../common/enums/unidade.enum';
import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

class VisitacaoPainelMedicoRepresentantesQueryDto {
  @ApiPropertyOptional({ enum: Unidade })
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;
}

@ApiTags('Visitação — Painel Médico')
@Controller('visitacao/painel-medico')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class VisitacaoPainelMedicoController {
  constructor(private readonly service: VisitacaoPainelMedicoService) {}

  @Get('representantes')
  @Permissions(Permission.VISITACAO_PAINEL_MEDICO_READ)
  @ApiOperation({
    summary: 'Lista funcionários com vínculo ao painel (filtro de representante)',
  })
  @ApiResponse({ status: 200, type: [VisitacaoPainelMedicoRepresentanteDto] })
  listarRepresentantes(
    @Req() req: { user: Usuario },
    @Query() query: VisitacaoPainelMedicoRepresentantesQueryDto,
  ): Promise<VisitacaoPainelMedicoRepresentanteDto[]> {
    return this.service.listarRepresentantesVinculados(
      req.user,
      query.unidade,
    );
  }

  @Get()
  @Permissions(Permission.VISITACAO_PAINEL_MEDICO_READ)
  @ApiOperation({
    summary:
      'Lista médicos do painel sincronizado (escopo por unidade do usuário)',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de médicos × representantes',
  })
  findAll(
    @Req() req: { user: Usuario },
    @Query() query: FindVisitacaoPainelMedicoDto,
  ): Promise<PaginatedResponseDto<VisitacaoPainelMedicoItemDto>> {
    return this.service.findAll(req.user, query);
  }
}
