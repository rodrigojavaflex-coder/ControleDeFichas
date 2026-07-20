import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ProducaoConfigService } from './producao-config.service';
import { ProducaoConfigUnidadeQueryDto } from './dto/producao-config-unidade-query.dto';
import { AplicarEtapasRemuneradasDto } from './dto/aplicar-etapas-remuneradas.dto';
import {
  RemoverEtapasFuncionariosDto,
  RemoverEtapasFuncionariosResponseDto,
} from './dto/remover-etapas-funcionarios.dto';
import { BulkSaveProducaoEtapasDto } from './dto/bulk-save-producao-etapas.dto';
import { BulkSaveProducaoFuncionarioEtapasDto } from './dto/bulk-save-producao-funcionario-etapas.dto';
import {
  VinculoCodigoFuncionarioConfirmResponseDto,
  VinculoCodigoFuncionarioPreviewResponseDto,
} from './dto/vincular-codigo-funcionario-preview.dto';
import { ConfirmarVinculoCodigoFuncionarioDto } from './dto/confirmar-vinculo-codigo-funcionario.dto';
import {
  AplicarEtapasRemuneradasResponseDto,
  ProducaoConfigRelatorioResponseDto,
} from './dto/producao-config-relatorio.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';

@ApiTags('Produção — Configuração')
@Controller('producao/config')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ProducaoConfigController {
  constructor(private readonly service: ProducaoConfigService) {}

  @Get('etapas')
  @Permissions(Permission.PRODUCAO_CONFIG_READ)
  @ApiOperation({ summary: 'Lista etapas da unidade com config de remuneração' })
  @ApiResponse({ status: 200 })
  listarEtapas(
    @Req() req: { user: Usuario },
    @Query() query: ProducaoConfigUnidadeQueryDto,
  ) {
    return this.service.listarEtapas(req.user, query.unidade);
  }

  @Put('etapas/bulk')
  @Permissions(Permission.PRODUCAO_CONFIG_UPDATE)
  @ApiOperation({ summary: 'Salva config de remuneração das etapas (bulk)' })
  @ApiResponse({ status: 200 })
  salvarEtapas(
    @Req() req: { user: Usuario },
    @Body() dto: BulkSaveProducaoEtapasDto,
  ) {
    return this.service.salvarEtapas(req.user, dto);
  }

  @Get('funcionarios')
  @Permissions(Permission.PRODUCAO_CONFIG_READ)
  @ApiOperation({ summary: 'Lista funcionários da unidade para config' })
  @ApiResponse({ status: 200 })
  listarFuncionarios(
    @Req() req: { user: Usuario },
    @Query() query: ProducaoConfigUnidadeQueryDto,
  ) {
    return this.service.listarFuncionarios(req.user, query.unidade);
  }

  @Get('funcionarios/:funcionarioId/etapas')
  @Permissions(Permission.PRODUCAO_CONFIG_READ)
  @ApiOperation({ summary: 'Etapas configuradas para um funcionário' })
  @ApiResponse({ status: 200 })
  listarEtapasFuncionario(
    @Req() req: { user: Usuario },
    @Param('funcionarioId', ParseUUIDPipe) funcionarioId: string,
    @Query() query: ProducaoConfigUnidadeQueryDto,
  ) {
    return this.service.listarEtapasFuncionario(
      req.user,
      query.unidade,
      funcionarioId,
    );
  }

  @Put('funcionarios/:funcionarioId/etapas/bulk')
  @Permissions(Permission.PRODUCAO_CONFIG_UPDATE)
  @ApiOperation({ summary: 'Salva etapas que o funcionário recebe (bulk)' })
  @ApiResponse({ status: 200 })
  salvarEtapasFuncionario(
    @Req() req: { user: Usuario },
    @Param('funcionarioId', ParseUUIDPipe) funcionarioId: string,
    @Body() dto: BulkSaveProducaoFuncionarioEtapasDto,
  ) {
    return this.service.salvarEtapasFuncionario(
      req.user,
      funcionarioId,
      dto,
    );
  }

  @Get('relatorio')
  @Permissions(Permission.PRODUCAO_CONFIG_READ)
  @ApiOperation({
    summary:
      'Relatório: etapas remuneradas da unidade e etapas configuradas por funcionário',
  })
  @ApiResponse({ status: 200, type: ProducaoConfigRelatorioResponseDto })
  gerarRelatorioConfig(
    @Req() req: { user: Usuario },
    @Query() query: ProducaoConfigUnidadeQueryDto,
  ): Promise<ProducaoConfigRelatorioResponseDto> {
    return this.service.gerarRelatorioConfig(req.user, query.unidade);
  }

  @Post('funcionarios/aplicar-etapas-remuneradas')
  @Permissions(Permission.PRODUCAO_CONFIG_UPDATE)
  @ApiOperation({
    summary:
      'Aplica etapas remuneradas da unidade aos funcionários selecionados com código ERP',
  })
  @ApiResponse({ status: 200, type: AplicarEtapasRemuneradasResponseDto })
  aplicarEtapasRemuneradasTodosFuncionarios(
    @Req() req: { user: Usuario },
    @Body() dto: AplicarEtapasRemuneradasDto,
  ): Promise<AplicarEtapasRemuneradasResponseDto> {
    return this.service.aplicarEtapasRemuneradasTodosFuncionarios(
      req.user,
      dto,
    );
  }

  @Post('funcionarios/remover-etapas')
  @Permissions(Permission.PRODUCAO_CONFIG_UPDATE)
  @ApiOperation({
    summary: 'Remove todas as etapas configuradas dos funcionários selecionados',
  })
  @ApiResponse({ status: 200, type: RemoverEtapasFuncionariosResponseDto })
  removerEtapasFuncionarios(
    @Req() req: { user: Usuario },
    @Body() dto: RemoverEtapasFuncionariosDto,
  ): Promise<RemoverEtapasFuncionariosResponseDto> {
    return this.service.removerEtapasFuncionarios(req.user, dto);
  }

  @Get('importacao/vincular-codigo-funcionario/preview')
  @Permissions(Permission.PRODUCAO_CONFIG_READ, Permission.CONFIGURACAO_ACCESS)
  @ApiOperation({
    summary:
      'Prévia: vincular codigoFuncionarioErp pelo nome (producao_etapas_resumo.funcSaida)',
  })
  @ApiResponse({ status: 200, type: VinculoCodigoFuncionarioPreviewResponseDto })
  previewVincularCodigoFuncionario(
    @Req() req: { user: Usuario },
    @Query() query: ProducaoConfigUnidadeQueryDto,
  ): Promise<VinculoCodigoFuncionarioPreviewResponseDto> {
    return this.service.previewVincularCodigoFuncionario(
      req.user,
      query.unidade,
    );
  }

  @Post('importacao/vincular-codigo-funcionario/confirmar')
  @Permissions(Permission.PRODUCAO_CONFIG_UPDATE, Permission.CONFIGURACAO_ACCESS)
  @ApiOperation({
    summary:
      'Confirma vínculo seguro de codigoFuncionarioErp (match único, código ainda NULL)',
  })
  @ApiResponse({ status: 200, type: VinculoCodigoFuncionarioConfirmResponseDto })
  confirmarVincularCodigoFuncionario(
    @Req() req: { user: Usuario },
    @Body() dto: ConfirmarVinculoCodigoFuncionarioDto,
  ): Promise<VinculoCodigoFuncionarioConfirmResponseDto> {
    return this.service.confirmarVincularCodigoFuncionario(
      req.user,
      dto.unidade,
      dto.funcionarioIds,
    );
  }
}
