import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProducaoPainelService } from './producao-painel.service';
import { AcompanhamentoUnidadesQueryDto } from '../producao-acompanhamento/dto/acompanhamento-unidades-query.dto';
import { ProducaoPainelResponseDto } from './dto/producao-painel-response.dto';
import {
  ProducaoPainelHistoricoQueryDto,
  ProducaoPainelHistoricoResponseDto,
} from './dto/producao-painel-historico.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';

@ApiTags('Produção — Painel de retirada')
@Controller('producao/painel')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ProducaoPainelController {
  constructor(private readonly service: ProducaoPainelService) {}

  @Get('historico')
  @Permissions(Permission.PRODUCAO_PAINEL_READ)
  @ApiOperation({
    summary: 'Histórico da requisição-fórmula por etapa (resumo importado)',
  })
  @ApiResponse({ status: 200, type: ProducaoPainelHistoricoResponseDto })
  historico(
    @Req() req: { user: Usuario },
    @Query() query: ProducaoPainelHistoricoQueryDto,
  ): Promise<ProducaoPainelHistoricoResponseDto> {
    return this.service.historicoRequisicao(
      req.user,
      query.unidade,
      query.filial,
      query.requisicao,
      query.formula,
    );
  }

  @Get()
  @Permissions(Permission.PRODUCAO_PAINEL_READ)
  @ApiOperation({
    summary:
      'Lista requisições-fórmulas em produção com prazo de retirada e semáforo',
  })
  @ApiResponse({ status: 200, type: ProducaoPainelResponseDto })
  consultar(
    @Req() req: { user: Usuario },
    @Query() query: AcompanhamentoUnidadesQueryDto,
  ): Promise<ProducaoPainelResponseDto> {
    return this.service.consultar(
      req.user,
      query.unidades,
      query.unidade,
    );
  }
}
