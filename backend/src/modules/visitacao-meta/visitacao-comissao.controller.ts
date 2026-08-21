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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { VisitacaoMetaService } from './visitacao-meta.service';
import {
  FindVisitacaoComissaoFaixaDto,
  FindVisitacaoComissaoRepresentantesDto,
  SalvarVisitacaoComissaoFaixaDto,
  VisitacaoComissaoFaixaItemDto,
  VisitacaoComissaoRepresentantesResponseDto,
} from './dto/visitacao-comissao-faixa.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';

@ApiTags('Visitação — Configuração Comissões')
@Controller('visitacao/comissoes')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class VisitacaoComissaoController {
  constructor(private readonly service: VisitacaoMetaService) {}

  @Get('representantes')
  @Permissions(Permission.VISITACAO_COMISSAO_READ)
  @ApiOperation({
    summary:
      'Lista representantes da unidade (cdfun e cdcon do painel preenchidos)',
  })
  @ApiResponse({ status: 200, type: VisitacaoComissaoRepresentantesResponseDto })
  listarRepresentantes(
    @Req() req: { user: Usuario },
    @Query() query: FindVisitacaoComissaoRepresentantesDto,
  ): Promise<VisitacaoComissaoRepresentantesResponseDto> {
    return this.service.listarRepresentantesComissao(req.user, query.unidade);
  }

  @Get()
  @Permissions(Permission.VISITACAO_COMISSAO_READ)
  @ApiOperation({ summary: 'Lista faixas de comissão do representante' })
  @ApiResponse({ status: 200, type: [VisitacaoComissaoFaixaItemDto] })
  listarFaixas(
    @Req() req: { user: Usuario },
    @Query() query: FindVisitacaoComissaoFaixaDto,
  ): Promise<VisitacaoComissaoFaixaItemDto[]> {
    return this.service.listarFaixas(req.user, query.funcionarioId);
  }

  @Post('carregar-padrao')
  @Permissions(Permission.VISITACAO_COMISSAO_CREATE)
  @ApiOperation({
    summary:
      'Carrega as faixas padrão do representante (substitui as existentes)',
  })
  @ApiResponse({ status: 200, type: [VisitacaoComissaoFaixaItemDto] })
  carregarPadrao(
    @Req() req: { user: Usuario },
    @Body() dto: FindVisitacaoComissaoFaixaDto,
  ): Promise<VisitacaoComissaoFaixaItemDto[]> {
    return this.service.carregarFaixasPadrao(req.user, dto.funcionarioId);
  }

  @Post()
  @Permissions(Permission.VISITACAO_COMISSAO_CREATE)
  @ApiOperation({ summary: 'Inclui faixa de comissão do representante' })
  @ApiResponse({ status: 200, type: [VisitacaoComissaoFaixaItemDto] })
  criarFaixa(
    @Req() req: { user: Usuario },
    @Body() dto: SalvarVisitacaoComissaoFaixaDto,
  ): Promise<VisitacaoComissaoFaixaItemDto[]> {
    return this.service.criarFaixa(req.user, dto);
  }

  @Patch(':id')
  @Permissions(Permission.VISITACAO_COMISSAO_UPDATE)
  @ApiOperation({ summary: 'Altera faixa de comissão do representante' })
  @ApiResponse({ status: 200, type: [VisitacaoComissaoFaixaItemDto] })
  atualizarFaixa(
    @Req() req: { user: Usuario },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SalvarVisitacaoComissaoFaixaDto,
  ): Promise<VisitacaoComissaoFaixaItemDto[]> {
    return this.service.atualizarFaixa(req.user, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.VISITACAO_COMISSAO_DELETE)
  @ApiOperation({ summary: 'Exclui faixa de comissão do representante' })
  @ApiResponse({ status: 200, type: [VisitacaoComissaoFaixaItemDto] })
  excluirFaixa(
    @Req() req: { user: Usuario },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VisitacaoComissaoFaixaItemDto[]> {
    return this.service.excluirFaixa(req.user, id);
  }
}
