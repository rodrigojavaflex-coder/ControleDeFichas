import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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
import { ConcluirSolicitacaoDto } from './dto/concluir-solicitacao.dto';
import { CreateSolicitacaoDto } from './dto/create-solicitacao.dto';
import { FindGestaoSolicitacoesDto } from './dto/find-gestao-solicitacoes.dto';
import { FindSolicitacoesDto } from './dto/find-solicitacoes.dto';
import { TratarSolicitacaoDto } from './dto/tratar-solicitacao.dto';
import { SolicitacoesService } from './solicitacoes.service';
import {
  SolicitacaoResumo,
  SolicitacoesListaPaginada,
  MedicoSolicitacaoOpcao,
  SolicitacaoGestaoItem,
  SolicitacaoHistoricoItem,
} from './solicitacoes.types';

type ReqUsuario = { user: Usuario };

@ApiTags('Solicitações')
@Controller('solicitacoes')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class SolicitacoesController {
  constructor(private readonly service: SolicitacoesService) {}

  @Post()
  @Permissions(Permission.PENDENCIAS_CREATE)
  @ApiOperation({
    summary:
      'Registrar pendência vinculada ao usuário logado e, se informado, a um médico',
  })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 400, description: 'Texto ou médico inválido' })
  criar(
    @Req() req: ReqUsuario,
    @Body() dto: CreateSolicitacaoDto,
  ): Promise<SolicitacaoResumo> {
    return this.service.criar(req.user.id, dto);
  }

  @Get('medicos')
  @Permissions(
    Permission.PENDENCIAS_READ,
    Permission.PENDENCIAS_CREATE,
    Permission.VISITAS_AGENDA_READ,
    Permission.VISITAS_AGENDA_CREATE,
  )
  @ApiOperation({
    summary: 'Buscar médico da unidade; Todos/No painel/Fora filtram só esta busca',
  })
  @ApiQuery({ name: 'busca', required: false })
  @ApiQuery({ name: 'filtroPainel', required: false, enum: ['todos', 'no_painel', 'fora_painel'] })
  @ApiResponse({ status: 200 })
  medicos(
    @Req() req: ReqUsuario,
    @Query('busca') busca?: string,
    @Query('filtroPainel') filtroPainel?: string,
  ): Promise<MedicoSolicitacaoOpcao[]> {
    return this.service.buscarMedicos(req.user.id, busca ?? '', filtroPainel);
  }

  @Get('gestao')
  @Permissions(Permission.PENDENCIAS_WEB_READ)
  @ApiOperation({ summary: 'Pendências da unidade para a tela web' })
  @ApiResponse({ status: 200 })
  gestao(
    @Req() req: ReqUsuario,
    @Query() query: FindGestaoSolicitacoesDto,
  ): Promise<SolicitacaoGestaoItem[]> {
    return this.service.listarGestao(req.user.id, query);
  }

  @Get('a-concluir')
  @Permissions(Permission.PENDENCIAS_READ, Permission.PENDENCIAS_CREATE)
  @ApiOperation({
    summary: 'Quantidade de pendências resolvidas que o visitador ainda precisa concluir',
  })
  @ApiResponse({ status: 200 })
  aConcluir(@Req() req: ReqUsuario): Promise<{ total: number }> {
    return this.service.contarAConcluir(req.user.id);
  }

  @Patch(':id/tratar')
  @Permissions(Permission.PENDENCIAS_WEB_UPDATE)
  @ApiOperation({ summary: 'Resolver ou reabrir uma pendência, com descrição obrigatória' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'Descrição ausente, situação inválida ou outra unidade' })
  @ApiResponse({ status: 404, description: 'Pendência não encontrada' })
  tratar(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TratarSolicitacaoDto,
  ): Promise<SolicitacaoGestaoItem> {
    return this.service.tratar(req.user.id, id, dto);
  }

  @Patch(':id/concluir')
  @Permissions(Permission.PENDENCIAS_READ)
  @ApiOperation({ summary: 'Visitador que registrou conclui a pendência resolvida' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'Descrição ausente ou pendência ainda não resolvida' })
  @ApiResponse({ status: 404, description: 'Pendência não encontrada' })
  concluir(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConcluirSolicitacaoDto,
  ): Promise<SolicitacaoResumo> {
    return this.service.concluir(req.user.id, id, dto);
  }

  @Get(':id/historico')
  @Permissions(Permission.PENDENCIAS_WEB_READ, Permission.PENDENCIAS_READ)
  @ApiOperation({ summary: 'Histórico de situação da pendência' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'Pendência de outro visitador ou unidade' })
  @ApiResponse({ status: 404, description: 'Pendência não encontrada' })
  historico(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SolicitacaoHistoricoItem[]> {
    return this.service.historico(req.user.id, id);
  }

  @Get()
  @Permissions(Permission.PENDENCIAS_READ, Permission.PENDENCIAS_CREATE)
  @ApiOperation({
    summary:
      'Pendências do visitador logado, com filtros (período, painel, status, tipo) e paginação',
  })
  @ApiResponse({ status: 200 })
  minhas(
    @Req() req: ReqUsuario,
    @Query() query: FindSolicitacoesDto,
  ): Promise<SolicitacoesListaPaginada> {
    return this.service.minhas(req.user.id, query);
  }
}
