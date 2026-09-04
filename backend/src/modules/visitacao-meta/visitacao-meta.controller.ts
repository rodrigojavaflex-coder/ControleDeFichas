import {
  Body,
  Controller,
  Post,
  Put,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { VisitacaoMetaService } from './visitacao-meta.service';
import {
  CopiarVisitacaoMetaDto,
  CopiarVisitacaoMetaResponseDto,
  FindVisitacaoMetaDto,
  ReavaliarPainelComissaoDto,
  SalvarUnidadesComissaoDto,
  SalvarVisitacaoMetaDto,
  UnidadesComissaoResponseDto,
  VisitacaoMetaListResponseDto,
} from './dto/visitacao-meta.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';

@ApiTags('Visitação — Configuração Metas')
@Controller('visitacao/metas')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class VisitacaoMetaController {
  constructor(private readonly service: VisitacaoMetaService) {}

  @Get()
  @Permissions(Permission.VISITACAO_META_READ)
  @ApiOperation({ summary: 'Lista metas do ano (mês opcional; omitido = todos)' })
  @ApiResponse({ status: 200, type: VisitacaoMetaListResponseDto })
  listar(
    @Req() req: { user: Usuario },
    @Query() query: FindVisitacaoMetaDto,
  ): Promise<VisitacaoMetaListResponseDto> {
    return this.service.listarMetas(req.user, query);
  }

  @Put()
  @Permissions(Permission.VISITACAO_META_UPDATE)
  @ApiOperation({ summary: 'Salva a meta mensal de um representante' })
  @ApiResponse({ status: 200, type: VisitacaoMetaListResponseDto })
  salvar(
    @Req() req: { user: Usuario },
    @Body() dto: SalvarVisitacaoMetaDto,
  ): Promise<VisitacaoMetaListResponseDto> {
    return this.service.salvarMeta(req.user, dto);
  }

  @Post('copiar')
  @Permissions(Permission.VISITACAO_META_UPDATE)
  @ApiOperation({ summary: 'Copia metas do mês de origem para o destino' })
  @ApiResponse({ status: 200, type: CopiarVisitacaoMetaResponseDto })
  copiar(
    @Req() req: { user: Usuario },
    @Body() dto: CopiarVisitacaoMetaDto,
  ): Promise<CopiarVisitacaoMetaResponseDto> {
    return this.service.copiarMesAnterior(req.user, dto);
  }

  @Put('unidades-comissao')
  @Permissions(Permission.VISITACAO_META_UPDATE)
  @ApiOperation({
    summary:
      'Define unidades que entram no card/comissão do representante. Não bloqueia se houver conflito de painel.',
  })
  @ApiResponse({ status: 200, type: UnidadesComissaoResponseDto })
  salvarUnidades(
    @Req() req: { user: Usuario },
    @Body() dto: SalvarUnidadesComissaoDto,
  ): Promise<UnidadesComissaoResponseDto> {
    return this.service.salvarUnidadesComissao(req.user, dto);
  }

  @Get('unidades-comissao/:funcionarioId')
  @Permissions(Permission.VISITACAO_META_READ)
  @ApiOperation({ summary: 'Unidades de comissão e conflitos de painel' })
  @ApiResponse({ status: 200, type: UnidadesComissaoResponseDto })
  obterUnidades(
    @Req() req: { user: Usuario },
    @Param('funcionarioId', ParseUUIDPipe) funcionarioId: string,
  ): Promise<UnidadesComissaoResponseDto> {
    return this.service.reavaliarPainelComissao(req.user, { funcionarioId });
  }

  @Post('unidades-comissao/reavaliar')
  @Permissions(Permission.VISITACAO_META_UPDATE)
  @ApiOperation({
    summary: 'Reavalia o painel das unidades configuradas e devolve conflitos',
  })
  @ApiResponse({ status: 200, type: UnidadesComissaoResponseDto })
  reavaliar(
    @Req() req: { user: Usuario },
    @Body() dto: ReavaliarPainelComissaoDto,
  ): Promise<UnidadesComissaoResponseDto> {
    return this.service.reavaliarPainelComissao(req.user, dto);
  }
}
