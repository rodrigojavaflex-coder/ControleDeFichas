import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
import { FolhaFechamentoService } from './folha-fechamento.service';
import { FolhaTiposService } from './folha-tipos.service';
import { FolhaFecharDto } from './dto/folha-fechar.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Unidade } from '../../common/enums/unidade.enum';
import {
  assertUnidadeFolha,
  resolverEscopoListaFechamentoPorUsuario,
} from './utils/folha-unidade-scope.util';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { FolhaCompetenciaGridRowDto } from './dto/folha-competencia-grid-row.dto';

function parseUnidadeQueryOpcional(raw?: string): Unidade | undefined {
  if (raw == null || raw === '') return undefined;
  if (!Object.values(Unidade).includes(raw as Unidade)) {
    throw new BadRequestException('Unidade inválida.');
  }
  return raw as Unidade;
}

/** Pelo menos uma permissão de Folha — Controle permite listar/visualizar relatórios desta área. */
const PERMS_CONTROLE_FOLHA_VISUALIZAR: Permission[] = [
  Permission.FOLHA_FECHAMENTO_READ,
  Permission.FOLHA_FECHAMENTO_REGISTRAR_ABERTURA,
  Permission.FOLHA_FECHAMENTO_FECHAR,
  Permission.FOLHA_FECHAMENTO_REABRIR,
];

@ApiTags('Folha — Controle de competências')
@Controller('folha/fechamento')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class FolhaFechamentoController {
  constructor(
    private readonly service: FolhaFechamentoService,
    private readonly tipos: FolhaTiposService,
  ) {}

  @Get('status')
  @Permissions(
    ...PERMS_CONTROLE_FOLHA_VISUALIZAR,
    Permission.FOLHA_LANCAMENTO_READ,
  )
  @ApiOperation({
    summary:
      'Status do lote (abertura registrada, fechado) por unidade/competência/tipo',
  })
  @ApiQuery({ name: 'unidade', enum: Unidade })
  @ApiQuery({ name: 'ano', type: Number })
  @ApiQuery({ name: 'mes', type: Number })
  @ApiQuery({ name: 'folhaTipoId', format: 'uuid' })
  status(
    @Query('unidade') unidade: Unidade,
    @Query('ano') ano: number,
    @Query('mes') mes: number,
    @Query('folhaTipoId') folhaTipoId: string,
    @Req() req: { user: Usuario },
  ) {
    assertUnidadeFolha(req.user, unidade);
    return this.service.getStatus(unidade, +ano, +mes, folhaTipoId);
  }

  @Get('competencias-registradas')
  @Permissions(...PERMS_CONTROLE_FOLHA_VISUALIZAR)
  @ApiOperation({
    summary:
      'Competências já registradas (folha_fechamento): filtro opcional por unidade, mês e tipo; usuário multi-unidade / admin omitindo unidade vê todas as que o vínculo permitir.',
  })
  @ApiOkResponse({ type: [FolhaCompetenciaGridRowDto] })
  @ApiQuery({ name: 'unidade', enum: Unidade, required: false })
  @ApiQuery({ name: 'ano', type: Number })
  @ApiQuery({ name: 'mes', type: Number, required: false })
  @ApiQuery({ name: 'folhaTipoId', required: false })
  competenciasRegistradas(
    @Query('unidade') unidadeRaw: string | undefined,
    @Query('ano') ano: number,
    @Query('mes') mesRaw: string | undefined,
    @Query('folhaTipoId') folhaTipoId: string | undefined,
    @Req() req: { user: Usuario },
  ): Promise<FolhaCompetenciaGridRowDto[]> {
    const unidadeOpcional = parseUnidadeQueryOpcional(unidadeRaw);
    const escopo = resolverEscopoListaFechamentoPorUsuario(req.user, unidadeOpcional);
    let mes: number | undefined;
    if (mesRaw !== undefined && mesRaw !== '') {
      mes = Number(mesRaw);
      if (!Number.isFinite(mes) || mes < 1 || mes > 12) {
        throw new BadRequestException('Mês inválido.');
      }
    }
    return this.service.listCompetenciasRegistradas({
      escopo,
      ano: +ano,
      mes,
      folhaTipoId: folhaTipoId?.trim() || undefined,
    });
  }

  @Post('abertura')
  @Permissions(Permission.FOLHA_FECHAMENTO_REGISTRAR_ABERTURA)
  @ApiOperation({ summary: 'Registrar abertura da competência (habilita lançamentos)' })
  registrarAbertura(@Body() dto: FolhaFecharDto, @Req() req: { user: Usuario }) {
    assertUnidadeFolha(req.user, dto.unidade);
    return this.tipos
      .findOne(dto.folhaTipoId)
      .then((tipo) =>
        this.service.registrarAbertura(
          dto.unidade,
          dto.ano,
          dto.mes,
          dto.folhaTipoId,
          tipo,
        ),
      );
  }

  @Post('fechar')
  @Permissions(Permission.FOLHA_FECHAMENTO_FECHAR)
  @ApiOperation({ summary: 'Fechar lote da competência (bloqueia edição)' })
  fechar(@Body() dto: FolhaFecharDto, @Req() req: { user: Usuario }) {
    assertUnidadeFolha(req.user, dto.unidade);
    return this.tipos
      .findOne(dto.folhaTipoId)
      .then((tipo) =>
        this.service.fechar(
          req.user,
          dto.unidade,
          dto.ano,
          dto.mes,
          dto.folhaTipoId,
          tipo,
        ),
      );
  }

  @Post('reabrir')
  @Permissions(Permission.FOLHA_FECHAMENTO_REABRIR)
  @ApiOperation({ summary: 'Reabrir competência fechada (habilita novamente lançamentos)' })
  reabrir(@Body() dto: FolhaFecharDto, @Req() req: { user: Usuario }) {
    assertUnidadeFolha(req.user, dto.unidade);
    return this.tipos
      .findOne(dto.folhaTipoId)
      .then((tipo) =>
        this.service.reabrir(dto.unidade, dto.ano, dto.mes, dto.folhaTipoId, tipo),
      );
  }
}
