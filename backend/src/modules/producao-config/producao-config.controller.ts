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
  AtualizarCodigoUsuarioErpProducaoDto,
  AtualizarCodigoUsuarioErpProducaoResponseDto,
} from './dto/atualizar-codigo-usuario-erp.dto';
import {
  AplicarEtapasRemuneradasResponseDto,
  ProducaoConfigRelatorioResponseDto,
} from './dto/producao-config-relatorio.dto';
import { ProducaoFuncionarioEtapasResponseDto } from './dto/producao-funcionario-etapas-response.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ProducaoCalendarioService } from './producao-calendario.service';
import { ProducaoPainelRetiradaConfigService } from './producao-painel-retirada-config.service';
import {
  ImportarFeriadosNacionaisDto,
  ImportarFeriadosNacionaisResponseDto,
  ProducaoFeriadoToggleDto,
  ProducaoFeriadosMesResponseDto,
  ProducaoJornadaResponseDto,
  SalvarProducaoJornadaDto,
} from './dto/producao-jornada-feriado.dto';
import { ProducaoFeriadosQueryDto } from './dto/producao-feriados-query.dto';
import {
  CalendarioUnidadeResponseDto,
  SalvarCalendarioUnidadeDto,
} from './dto/calendario-unidade.dto';
import {
  ProducaoPainelRetiradaConfigResponseDto,
  SalvarProducaoPainelRetiradaDto,
} from './dto/producao-painel-retirada.dto';
import { Unidade } from '../../common/enums/unidade.enum';

@ApiTags('Produção — Configuração')
@Controller('producao/config')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ProducaoConfigController {
  constructor(
    private readonly service: ProducaoConfigService,
    private readonly calendarioService: ProducaoCalendarioService,
    private readonly painelRetiradaConfigService: ProducaoPainelRetiradaConfigService,
  ) {}

  @Get('etapas')
  @Permissions(Permission.PRODUCAO_CONFIG_READ)
  @ApiOperation({
    summary: 'Lista etapas da unidade com config de remuneração',
  })
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
  @ApiResponse({ status: 200, type: ProducaoFuncionarioEtapasResponseDto })
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
  @ApiResponse({ status: 200, type: ProducaoFuncionarioEtapasResponseDto })
  salvarEtapasFuncionario(
    @Req() req: { user: Usuario },
    @Param('funcionarioId', ParseUUIDPipe) funcionarioId: string,
    @Body() dto: BulkSaveProducaoFuncionarioEtapasDto,
  ) {
    return this.service.salvarEtapasFuncionario(req.user, funcionarioId, dto);
  }

  @Put('funcionarios/:funcionarioId/codigo-usuario-erp')
  @Permissions(Permission.PRODUCAO_CONFIG_UPDATE_CODIGO_USUARIO_ERP)
  @ApiOperation({
    summary:
      'Atualiza codigoUsuarioErp (cdusu) do funcionário na unidade (produtividade)',
  })
  @ApiResponse({
    status: 200,
    type: AtualizarCodigoUsuarioErpProducaoResponseDto,
  })
  atualizarCodigoUsuarioErp(
    @Req() req: { user: Usuario },
    @Param('funcionarioId', ParseUUIDPipe) funcionarioId: string,
    @Body() dto: AtualizarCodigoUsuarioErpProducaoDto,
  ): Promise<AtualizarCodigoUsuarioErpProducaoResponseDto> {
    return this.service.atualizarCodigoUsuarioErp(
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
    summary:
      'Remove todas as etapas configuradas dos funcionários selecionados',
  })
  @ApiResponse({ status: 200, type: RemoverEtapasFuncionariosResponseDto })
  removerEtapasFuncionarios(
    @Req() req: { user: Usuario },
    @Body() dto: RemoverEtapasFuncionariosDto,
  ): Promise<RemoverEtapasFuncionariosResponseDto> {
    return this.service.removerEtapasFuncionarios(req.user, dto);
  }

  @Get('jornada')
  @Permissions(Permission.PRODUCAO_JORNADA_READ)
  @ApiOperation({ summary: 'Jornada de produção da unidade' })
  @ApiResponse({ status: 200, type: ProducaoJornadaResponseDto })
  obterJornada(
    @Req() req: { user: Usuario },
    @Query() query: ProducaoConfigUnidadeQueryDto,
  ): Promise<ProducaoJornadaResponseDto> {
    return this.calendarioService.obterJornada(req.user, query.unidade);
  }

  @Put('jornada')
  @Permissions(Permission.PRODUCAO_JORNADA_UPDATE)
  @ApiOperation({ summary: 'Salva jornada de produção da unidade' })
  @ApiResponse({ status: 200, type: ProducaoJornadaResponseDto })
  salvarJornada(
    @Req() req: { user: Usuario },
    @Body() dto: SalvarProducaoJornadaDto,
  ): Promise<ProducaoJornadaResponseDto> {
    return this.calendarioService.salvarJornada(req.user, dto);
  }

  @Get('calendario')
  @Permissions(Permission.FERIADO_READ)
  @ApiOperation({
    summary: 'Parâmetros de calendário da unidade (sábado útil)',
  })
  @ApiResponse({ status: 200, type: CalendarioUnidadeResponseDto })
  obterCalendario(
    @Req() req: { user: Usuario },
    @Query() query: ProducaoConfigUnidadeQueryDto,
  ): Promise<CalendarioUnidadeResponseDto> {
    return this.calendarioService.obterCalendarioUnidade(
      req.user,
      query.unidade,
    );
  }

  @Put('calendario')
  @Permissions(Permission.FERIADO_UPDATE)
  @ApiOperation({ summary: 'Salva parâmetro sábado útil da unidade' })
  @ApiResponse({ status: 200, type: CalendarioUnidadeResponseDto })
  salvarCalendario(
    @Req() req: { user: Usuario },
    @Body() dto: SalvarCalendarioUnidadeDto,
  ): Promise<CalendarioUnidadeResponseDto> {
    return this.calendarioService.salvarCalendarioUnidade(req.user, dto);
  }

  @Get('feriados')
  @Permissions(Permission.FERIADO_READ)
  @ApiOperation({ summary: 'Lista feriados da unidade por ano (mês opcional)' })
  @ApiResponse({ status: 200, type: ProducaoFeriadosMesResponseDto })
  listarFeriados(
    @Req() req: { user: Usuario },
    @Query() query: ProducaoFeriadosQueryDto,
  ): Promise<ProducaoFeriadosMesResponseDto> {
    if (query.mes != null) {
      return this.calendarioService.listarFeriadosMes(
        req.user,
        query.unidade,
        query.ano,
        query.mes,
      );
    }
    return this.calendarioService.listarFeriados(
      req.user,
      query.unidade,
      query.ano,
    );
  }

  @Post('feriados/incluir')
  @Permissions(Permission.FERIADO_UPDATE)
  @ApiOperation({ summary: 'Inclui feriado manual na unidade' })
  @ApiResponse({ status: 200, type: ProducaoFeriadosMesResponseDto })
  incluirFeriado(
    @Req() req: { user: Usuario },
    @Body() dto: ProducaoFeriadoToggleDto,
  ): Promise<ProducaoFeriadosMesResponseDto> {
    return this.calendarioService.incluirFeriado(req.user, dto);
  }

  @Post('feriados/remover')
  @Permissions(Permission.FERIADO_DELETE)
  @ApiOperation({ summary: 'Remove feriado da unidade' })
  @ApiResponse({ status: 200, type: ProducaoFeriadosMesResponseDto })
  removerFeriado(
    @Req() req: { user: Usuario },
    @Body() dto: ProducaoFeriadoToggleDto,
  ): Promise<ProducaoFeriadosMesResponseDto> {
    return this.calendarioService.removerFeriado(req.user, dto);
  }

  @Post('feriados/importar-nacionais')
  @Permissions(Permission.FERIADO_IMPORT)
  @ApiOperation({ summary: 'Importa feriados nacionais (Brasil API)' })
  @ApiResponse({ status: 200, type: ImportarFeriadosNacionaisResponseDto })
  importarFeriadosNacionais(
    @Req() req: { user: Usuario },
    @Body() dto: ImportarFeriadosNacionaisDto,
  ): Promise<ImportarFeriadosNacionaisResponseDto> {
    return this.calendarioService.importarFeriadosNacionais(
      req.user,
      dto.unidade as Unidade,
      dto.ano,
    );
  }

  @Get('painel-retirada')
  @Permissions(Permission.PRODUCAO_PAINEL_CONFIG_READ)
  @ApiOperation({ summary: 'Configuração do painel de retirada da unidade' })
  @ApiResponse({ status: 200, type: ProducaoPainelRetiradaConfigResponseDto })
  obterPainelRetirada(
    @Req() req: { user: Usuario },
    @Query() query: ProducaoConfigUnidadeQueryDto,
  ): Promise<ProducaoPainelRetiradaConfigResponseDto> {
    return this.painelRetiradaConfigService.obterConfig(
      req.user,
      query.unidade,
    );
  }

  @Put('painel-retirada')
  @Permissions(Permission.PRODUCAO_PAINEL_CONFIG_UPDATE)
  @ApiOperation({ summary: 'Salva configuração do painel de retirada' })
  @ApiResponse({ status: 200, type: ProducaoPainelRetiradaConfigResponseDto })
  salvarPainelRetirada(
    @Req() req: { user: Usuario },
    @Body() dto: SalvarProducaoPainelRetiradaDto,
  ): Promise<ProducaoPainelRetiradaConfigResponseDto> {
    return this.painelRetiradaConfigService.salvarConfig(req.user, dto);
  }
}
