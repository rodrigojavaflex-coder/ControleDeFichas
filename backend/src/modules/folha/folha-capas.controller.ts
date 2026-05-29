import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { FolhaCapasService } from './folha-capas.service';
import { QueryFolhaCapaDto } from './dto/query-folha-capa.dto';
import { CreateFolhaCapaDto } from './dto/create-folha-capa.dto';
import { CreateFolhaItemDto } from './dto/create-folha-item.dto';
import { UpdateFolhaItemDto } from './dto/update-folha-item.dto';
import { CarregarFolhaCompetenciaDto } from './dto/carregar-folha-competencia.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Unidade } from '../../common/enums/unidade.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { FolhaReciboWhatsappService } from '../whatsapp/folha-recibo-whatsapp.service';

@ApiTags('Folha — Capa e itens')
@Controller('folha/capas')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class FolhaCapasController {
  constructor(
    private readonly service: FolhaCapasService,
    private readonly reciboWhatsappService: FolhaReciboWhatsappService,
  ) {}

  @Post()
  @Permissions(Permission.FOLHA_LANCAMENTO_CREATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obter ou criar folha_capa para o funcionário e competência' })
  obterOuCriar(@Body() dto: CreateFolhaCapaDto, @Req() req: { user: Usuario }) {
    return this.service.obterOuCriar(req.user, dto);
  }

  @Post('carregar-competencia')
  @Permissions(Permission.FOLHA_LANCAMENTO_CREATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Obter ou criar capas para todos os funcionários elegíveis (RN-011) na unidade, competência e tipo',
  })
  carregarCompetencia(
    @Body() dto: CarregarFolhaCompetenciaDto,
    @Req() req: { user: Usuario },
  ) {
    return this.service.carregarCompetenciaLancamento(req.user, dto);
  }

  @Post('carregar-mensal')
  @Permissions(Permission.FOLHA_LANCAMENTO_CREATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Alias histórico de carregar-competencia (corpo igual; não exige tipo «mensal»).',
    deprecated: true,
  })
  carregarMensal(
    @Body() dto: CarregarFolhaCompetenciaDto,
    @Req() req: { user: Usuario },
  ) {
    return this.service.carregarCompetenciaLancamento(req.user, dto);
  }

  @Get()
  @Permissions(Permission.FOLHA_LANCAMENTO_READ)
  @ApiQuery({
    name: 'comDetalhe',
    required: false,
    type: Boolean,
    description:
      'Se true, inclui itens e devolve totais por capa (formato `FolhaCapaDetalheDto`).',
  })
  listar(@Query() q: QueryFolhaCapaDto, @Req() req: { user: Usuario }) {
    return this.service.listar(req.user, q);
  }

  @Get(':id/completa')
  @Permissions(Permission.FOLHA_LANCAMENTO_READ)
  @ApiQuery({ name: 'unidade', enum: Unidade, required: true })
  completa(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('unidade') unidade: Unidade,
    @Req() req: { user: Usuario },
  ) {
    return this.service.buscarCompletaPorId(req.user, id, unidade);
  }

  @Post(':id/congelar')
  @Permissions(Permission.FOLHA_LANCAMENTO_CONGELAR_CAPA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Congelar capa: bloqueia alteração de itens e do cadastro do funcionário até liberar',
  })
  @ApiQuery({ name: 'unidade', enum: Unidade, required: true })
  congelar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('unidade') unidade: Unidade,
    @Req() req: { user: Usuario },
  ) {
    return this.service.congelarCapa(req.user, id, unidade);
  }

  @Post(':id/liberar')
  @Permissions(Permission.FOLHA_LANCAMENTO_LIBERAR_CAPA)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liberar capa congelada (exige competência com lote aberto — RN-006)',
  })
  @ApiQuery({ name: 'unidade', enum: Unidade, required: true })
  liberar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('unidade') unidade: Unidade,
    @Req() req: { user: Usuario },
  ) {
    return this.service.liberarCapa(req.user, id, unidade);
  }

  @Post(':id/enviar-recibo-whatsapp')
  @Permissions(
    Permission.FOLHA_LANCAMENTO_ENVIAR_RECIBO_WHATSAPP,
    Permission.FOLHA_FECHAMENTO_ENVIAR_RECIBOS_WHATSAPP,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Enviar recibo da capa por WhatsApp (template + imagem PNG)',
  })
  @ApiQuery({ name: 'unidade', enum: Unidade, required: true })
  enviarReciboWhatsapp(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('unidade') unidade: Unidade,
    @Req() req: { user: Usuario },
  ) {
    return this.reciboWhatsappService.enviarReciboIndividual(req.user, id, unidade);
  }

  @Post(':id/itens')
  @Permissions(Permission.FOLHA_LANCAMENTO_CREATE)
  addItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('unidade') unidade: Unidade,
    @Body() dto: CreateFolhaItemDto,
    @Req() req: { user: Usuario },
  ) {
    return this.service.adicionarItem(req.user, id, unidade, dto);
  }

  @Patch(':capaId/itens/:itemId')
  @Permissions(Permission.FOLHA_LANCAMENTO_UPDATE)
  patchItem(
    @Param('capaId', ParseUUIDPipe) capaId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('unidade') unidade: Unidade,
    @Body() dto: UpdateFolhaItemDto,
    @Req() req: { user: Usuario },
  ) {
    return this.service.atualizarItemValor(
      req.user,
      capaId,
      itemId,
      unidade,
      dto,
    );
  }

  @Delete(':capaId/itens/:itemId')
  @Permissions(Permission.FOLHA_LANCAMENTO_DELETE)
  removeItem(
    @Param('capaId', ParseUUIDPipe) capaId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query('unidade') unidade: Unidade,
    @Req() req: { user: Usuario },
  ) {
    return this.service.removerItem(req.user, capaId, itemId, unidade);
  }
}
