import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProducaoProdutividadeService } from './producao-produtividade.service';
import { ProdutividadeQueryDto } from './dto/produtividade-query.dto';
import { ProdutividadeAnaliticoResponseDto } from './dto/produtividade-analitico-response.dto';
import { ProdutividadeConsultaResponseDto } from './dto/produtividade-response.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';

@ApiTags('Produção — Produtividade')
@Controller('producao/produtividade')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ProducaoProdutividadeController {
  constructor(private readonly service: ProducaoProdutividadeService) {}

  @Get()
  @Permissions(Permission.PRODUCAO_PRODUTIVIDADE_READ)
  @ApiOperation({
    summary:
      'Contabiliza etapas de produção no período conforme config de remuneração e etapas por funcionário',
  })
  @ApiResponse({ status: 200, type: ProdutividadeConsultaResponseDto })
  consultar(
    @Req() req: { user: Usuario },
    @Query() query: ProdutividadeQueryDto,
  ): Promise<ProdutividadeConsultaResponseDto> {
    return this.service.consultar(
      req.user,
      query.unidades,
      query.dataInicio,
      query.dataFim,
      query.unidade,
    );
  }

  @Get('analitico')
  @Permissions(Permission.PRODUCAO_PRODUTIVIDADE_READ)
  @ApiOperation({
    summary:
      'Lista linhas contabilizadas da produtividade (funcionário, etapa, requisição, fórmula e data)',
  })
  @ApiResponse({ status: 200, type: ProdutividadeAnaliticoResponseDto })
  consultarAnalitico(
    @Req() req: { user: Usuario },
    @Query() query: ProdutividadeQueryDto,
  ): Promise<ProdutividadeAnaliticoResponseDto> {
    return this.service.consultarAnalitico(
      req.user,
      query.unidades,
      query.dataInicio,
      query.dataFim,
      query.unidade,
    );
  }
}
