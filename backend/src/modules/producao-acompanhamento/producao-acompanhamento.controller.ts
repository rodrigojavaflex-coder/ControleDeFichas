import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProducaoAcompanhamentoService } from './producao-acompanhamento.service';
import { AcompanhamentoUnidadesQueryDto } from './dto/acompanhamento-unidades-query.dto';
import { AcompanhamentoDetalheQueryDto } from './dto/acompanhamento-detalhe-query.dto';
import {
  AcompanhamentoDetalheResponseDto,
  AcompanhamentoLocalizarResponseDto,
  AcompanhamentoResumoResponseDto,
} from './dto/acompanhamento-response.dto';
import { AcompanhamentoLocalizarQueryDto } from './dto/acompanhamento-localizar-query.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';

@ApiTags('Produção — Acompanhamento')
@Controller('producao/acompanhamento')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ProducaoAcompanhamentoController {
  constructor(private readonly service: ProducaoAcompanhamentoService) {}

  @Get('resumo')
  @Permissions(Permission.PRODUCAO_ACOMPANHAMENTO_READ)
  @ApiOperation({
    summary:
      'Resumo da fila em andamento por etapa (requisições e tempo médio decorrido)',
  })
  @ApiResponse({ status: 200, type: AcompanhamentoResumoResponseDto })
  resumo(
    @Req() req: { user: Usuario },
    @Query() query: AcompanhamentoUnidadesQueryDto,
  ): Promise<AcompanhamentoResumoResponseDto> {
    return this.service.consultarResumo(
      req.user,
      query.unidades,
      query.unidade,
    );
  }

  @Get('detalhe')
  @Permissions(Permission.PRODUCAO_ACOMPANHAMENTO_READ)
  @ApiOperation({
    summary:
      'Detalhe da fila em uma etapa: requisições, fórmulas e funcionários na entrada',
  })
  @ApiResponse({ status: 200, type: AcompanhamentoDetalheResponseDto })
  detalhe(
    @Req() req: { user: Usuario },
    @Query() query: AcompanhamentoDetalheQueryDto,
  ): Promise<AcompanhamentoDetalheResponseDto> {
    return this.service.consultarDetalhe(
      req.user,
      query.codEtapa,
      query.unidades,
      query.unidade,
    );
  }

  @Get('localizar')
  @Permissions(Permission.PRODUCAO_ACOMPANHAMENTO_READ)
  @ApiOperation({
    summary:
      'Localiza em qual etapa a requisição-fórmula está na fila (em andamento)',
  })
  @ApiResponse({ status: 200, type: AcompanhamentoLocalizarResponseDto })
  @ApiResponse({ status: 404, description: 'Não encontrada na fila' })
  localizar(
    @Req() req: { user: Usuario },
    @Query() query: AcompanhamentoLocalizarQueryDto,
  ): Promise<AcompanhamentoLocalizarResponseDto> {
    return this.service.localizarRequisicaoFormula(
      req.user,
      query.requisicao,
      query.formula,
      query.unidades,
      query.unidade,
      query.filial,
    );
  }
}
