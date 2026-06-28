import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrcamentosDashboardService } from './orcamentos-dashboard.service';
import { FindOrcamentosDashboardDto } from './dto/find-orcamentos-dashboard.dto';
import {
  OrcamentosDashboardIndicadoresDto,
  OrcamentosDashboardOpcoesFiltroDto,
} from './dto/orcamentos-dashboard-response.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';

@ApiTags('Orçamentos — Dashboard')
@Controller('orcamentos/dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class OrcamentosDashboardController {
  constructor(private readonly service: OrcamentosDashboardService) {}

  @Get('indicadores')
  @Permissions(Permission.ORCAMENTO_DASHBOARD_READ)
  @ApiOperation({ summary: 'Indicadores consolidados do painel de orçamentos' })
  @ApiResponse({ status: 200, type: OrcamentosDashboardIndicadoresDto })
  getIndicadores(
    @Query() dto: FindOrcamentosDashboardDto,
    @Req() req: { user: Usuario },
  ): Promise<OrcamentosDashboardIndicadoresDto> {
    return this.service.getIndicadores(dto, req.user);
  }

  @Get('opcoes-filtro')
  @Permissions(Permission.ORCAMENTO_DASHBOARD_READ)
  @ApiOperation({
    summary: 'Opções de vendedor e médico para filtros do dashboard',
  })
  @ApiResponse({ status: 200, type: OrcamentosDashboardOpcoesFiltroDto })
  getOpcoesFiltro(
    @Query() dto: FindOrcamentosDashboardDto,
    @Req() req: { user: Usuario },
  ): Promise<OrcamentosDashboardOpcoesFiltroDto> {
    return this.service.getOpcoesFiltro(dto, req.user);
  }
}
