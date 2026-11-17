import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AtualizarVisitaDto } from './dto/atualizar-visita.dto';
import { EncerrarVisitaDto } from './dto/encerrar-visita.dto';
import { IniciarVisitaDto } from './dto/iniciar-visita.dto';
import { VisitasService } from './visitas.service';
import {
  AgendaVisitasMesDto,
  FindAgendaVisitasDto,
} from './dto/agenda-visitas.dto';
import {
  AgendaAlertasDto,
  AgendamentoVisitaItemDto,
  AtualizarAgendamentoVisitaDto,
  ChecarDataAgendamentoDto,
  ChecarDataAgendamentoResultadoDto,
  CriarAgendamentoVisitaDto,
  FindAgendamentosVisitaDto,
} from './dto/agendamento-visita.dto';
import { FindMinhasVisitasDto } from './dto/find-minhas-visitas.dto';
import {
  CarteiraVisitas,
  HistoricoVisita,
  PainelPrescritorVisita,
  VisitaResumo,
} from './visitas.types';

type ReqUsuario = { user: Usuario };

@ApiTags('Visitas')
@Controller('visitas')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class VisitasController {
  constructor(private readonly service: VisitasService) {}

  @Get('carteira')
  @Permissions(Permission.VISITAS_READ)
  @ApiOperation({
    summary:
      'Prescritores da unidade do funcionário vinculado, com filtro de painel',
  })
  @ApiQuery({
    name: 'filtroPainel',
    required: false,
    enum: ['todos', 'no_painel', 'fora_painel'],
    description: 'Filtro de participação no painel do representante',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Página (1-based). Padrão 1.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Itens por página (máx. 100). Padrão 40.',
  })
  @ApiQuery({
    name: 'busca',
    required: false,
    description: 'Filtro por nome ou CRM',
  })
  @ApiResponse({ status: 200 })
  carteira(
    @Req() req: ReqUsuario,
    @Query('filtroPainel') filtroPainel?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('busca') busca?: string,
  ): Promise<CarteiraVisitas> {
    return this.service.carteira(req.user.id, {
      filtroPainel,
      page,
      limit,
      busca,
    });
  }

  @Get('minhas')
  @Permissions(Permission.VISITAS_READ)
  @ApiOperation({
    summary:
      'Histórico de visitas do usuário logado, com filtro opcional de período e de dias',
  })
  @ApiQuery({
    name: 'periodo',
    required: false,
    enum: ['ano', 'mes', 'personalizado'],
  })
  @ApiQuery({ name: 'ano', required: false })
  @ApiQuery({ name: 'mes', required: false })
  @ApiQuery({ name: 'dataInicio', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'dataFim', required: false, example: '2026-01-31' })
  @ApiQuery({
    name: 'diasComparacao',
    required: false,
    enum: ['mais', 'menos'],
    description: 'Mais de X dias ou menos de X dias',
  })
  @ApiQuery({ name: 'dias', required: false, example: 5 })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'Período inválido' })
  minhas(
    @Req() req: ReqUsuario,
    @Query() query: FindMinhasVisitasDto,
  ): Promise<HistoricoVisita[]> {
    return this.service.minhas(req.user.id, query);
  }

  @Get('agenda/alertas')
  @Permissions(
    Permission.VISITAS_AGENDA_READ,
    Permission.PENDENCIAS_READ,
    Permission.PENDENCIAS_CREATE,
  )
  @ApiOperation({
    summary:
      'Resumo unificado: pendências abertas/resolvidas + agendamentos da semana',
  })
  @ApiResponse({ status: 200, type: AgendaAlertasDto })
  agendaAlertas(@Req() req: ReqUsuario): Promise<AgendaAlertasDto> {
    return this.service.agendaAlertas(req.user.id);
  }

  @Get('agenda')
  @Permissions(Permission.VISITAS_AGENDA_READ)
  @ApiOperation({
    summary:
      'Calendário do mês: visitas e agendamentos do usuário por dia (America/Sao_Paulo)',
  })
  @ApiResponse({ status: 200, type: AgendaVisitasMesDto })
  agenda(
    @Req() req: ReqUsuario,
    @Query() query: FindAgendaVisitasDto,
  ): Promise<AgendaVisitasMesDto> {
    return this.service.agendaMes(req.user.id, query.ano, query.mes);
  }

  @Get('agendamentos')
  @Permissions(Permission.VISITAS_AGENDA_READ)
  @ApiOperation({
    summary:
      'Listar próximos agendamentos do usuário (filtro opcional por médico)',
  })
  @ApiResponse({ status: 200, type: [AgendamentoVisitaItemDto] })
  listarAgendamentos(
    @Req() req: ReqUsuario,
    @Query() query: FindAgendamentosVisitaDto,
  ): Promise<AgendamentoVisitaItemDto[]> {
    return this.service.listarAgendamentosPorMedico(req.user.id, query);
  }

  @Get('agendamentos/checar-data')
  @Permissions(
    Permission.VISITAS_AGENDA_READ,
    Permission.VISITAS_AGENDA_CREATE,
  )
  @ApiOperation({
    summary:
      'Verifica se a data é sábado, domingo ou feriado da unidade (aviso ao agendar)',
  })
  @ApiResponse({ status: 200, type: ChecarDataAgendamentoResultadoDto })
  checarDataAgendamento(
    @Req() req: ReqUsuario,
    @Query() query: ChecarDataAgendamentoDto,
  ): Promise<ChecarDataAgendamentoResultadoDto> {
    return this.service.checarDataAgendamento(req.user.id, query.data);
  }

  @Post('agendamentos')
  @Permissions(Permission.VISITAS_AGENDA_CREATE)
  @ApiOperation({ summary: 'Criar agendamento de visita no calendário' })
  @ApiResponse({ status: 201, type: AgendamentoVisitaItemDto })
  criarAgendamento(
    @Req() req: ReqUsuario,
    @Body() dto: CriarAgendamentoVisitaDto,
  ): Promise<AgendamentoVisitaItemDto> {
    return this.service.criarAgendamento(req.user.id, dto);
  }

  @Patch('agendamentos/:id')
  @Permissions(Permission.VISITAS_AGENDA_UPDATE)
  @ApiOperation({ summary: 'Alterar agendamento de visita' })
  @ApiResponse({ status: 200, type: AgendamentoVisitaItemDto })
  atualizarAgendamento(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarAgendamentoVisitaDto,
  ): Promise<AgendamentoVisitaItemDto> {
    return this.service.atualizarAgendamento(req.user.id, id, dto);
  }

  @Delete('agendamentos/:id')
  @Permissions(Permission.VISITAS_AGENDA_DELETE)
  @ApiOperation({ summary: 'Excluir agendamento de visita' })
  @ApiResponse({ status: 200 })
  excluirAgendamento(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.excluirAgendamento(req.user.id, id);
  }

  @Get(':id/painel')
  @Permissions(
    Permission.VISITAS_READ,
    Permission.VISITAS_GERIR,
    Permission.VISITAS_AGENDA_READ,
  )
  @ApiOperation({
    summary:
      'Painel do prescritor na visita (pendências, histórico, orçamentos e ativos do mês)',
  })
  @ApiQuery({
    name: 'competencia',
    required: false,
    description: 'Mês YYYY-MM (America/Sao_Paulo). Padrão: mês atual.',
  })
  @ApiResponse({ status: 200 })
  painel(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('competencia') competencia?: string,
  ): Promise<PainelPrescritorVisita> {
    return this.service.painelPrescritor(req.user.id, id, competencia);
  }

  @Get(':id')
  @Permissions(
    Permission.VISITAS_READ,
    Permission.VISITAS_GERIR,
    Permission.VISITAS_AGENDA_READ,
  )
  @ApiOperation({ summary: 'Detalhe da visita' })
  @ApiResponse({ status: 200 })
  obter(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VisitaResumo> {
    return this.service.obter(req.user.id, id);
  }

  @Post()
  @Permissions(Permission.VISITAS_CREATE)
  @ApiOperation({ summary: 'Iniciar visita com coordenada' })
  @ApiResponse({ status: 201 })
  iniciar(
    @Req() req: ReqUsuario,
    @Body() dto: IniciarVisitaDto,
  ): Promise<VisitaResumo> {
    return this.service.iniciar(req.user.id, dto);
  }

  @Post(':id/encerrar')
  @Permissions(Permission.VISITAS_UPDATE)
  @ApiOperation({
    summary: 'Encerrar visita (localização permanece a do início)',
  })
  @ApiResponse({ status: 200 })
  encerrar(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EncerrarVisitaDto,
  ): Promise<VisitaResumo> {
    return this.service.encerrar(req.user.id, id, dto);
  }

  @Patch(':id')
  @Permissions(Permission.VISITAS_UPDATE, Permission.VISITAS_GERIR)
  @ApiOperation({ summary: 'Trocar médico ou editar textos da visita' })
  @ApiResponse({ status: 200 })
  atualizar(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarVisitaDto,
  ): Promise<VisitaResumo> {
    return this.service.atualizar(req.user.id, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.VISITAS_DELETE, Permission.VISITAS_GERIR)
  @ApiOperation({ summary: 'Exclusão física da visita e mídias' })
  @ApiResponse({ status: 200 })
  excluir(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.excluir(req.user.id, id);
  }
}
