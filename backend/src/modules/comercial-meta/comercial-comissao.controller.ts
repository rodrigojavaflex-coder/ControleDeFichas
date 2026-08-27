import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { ComercialMetaService } from './comercial-meta.service';
import {
  FindComercialComissaoFaixaDto,
  FindComercialComissaoVendedoresDto,
  SalvarComercialComissaoFaixaDto,
  ComercialComissaoFaixaItemDto,
  ComercialComissaoVendedoresResponseDto,
  CarregarComercialComissaoPadraoPendentesDto,
  CarregarComercialComissaoPadraoPendentesResponseDto,
  FindComercialComissaoPoliticaDto,
  ComercialComissaoPoliticaResponseDto,
  SalvarComercialComissaoPoliticaDto,
} from './dto/comercial-comissao-faixa.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';

@ApiTags('Comercial — Configuração Comissões')
@Controller('comercial/comissoes')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ComercialComissaoController {
  constructor(private readonly service: ComercialMetaService) {}

  @Get('vendedores')
  @Permissions(Permission.COMERCIAL_COMISSAO_READ)
  @ApiOperation({
    summary: 'Lista vendedores da unidade com código vendedor ERP preenchido',
  })
  @ApiResponse({ status: 200, type: ComercialComissaoVendedoresResponseDto })
  listarVendedores(
    @Req() req: { user: Usuario },
    @Query() query: FindComercialComissaoVendedoresDto,
  ): Promise<ComercialComissaoVendedoresResponseDto> {
    return this.service.listarVendedoresComissao(req.user, query.unidade);
  }

  @Get()
  @Permissions(Permission.COMERCIAL_COMISSAO_READ)
  @ApiOperation({ summary: 'Lista faixas de comissão do vendedor por tipo' })
  @ApiResponse({ status: 200, type: [ComercialComissaoFaixaItemDto] })
  listarFaixas(
    @Req() req: { user: Usuario },
    @Query() query: FindComercialComissaoFaixaDto,
  ): Promise<ComercialComissaoFaixaItemDto[]> {
    return this.service.listarFaixas(
      req.user,
      query.funcionarioId,
      query.tipoBase,
    );
  }

  @Get('politica')
  @Permissions(Permission.COMERCIAL_COMISSAO_READ)
  @ApiOperation({
    summary: 'Consulta incidência e trava da loja do vendedor (duas bases)',
  })
  @ApiResponse({ status: 200, type: ComercialComissaoPoliticaResponseDto })
  listarPolitica(
    @Req() req: { user: Usuario },
    @Query() query: FindComercialComissaoPoliticaDto,
  ): Promise<ComercialComissaoPoliticaResponseDto> {
    return this.service.listarPolitica(req.user, query.funcionarioId);
  }

  @Put('politica')
  @Permissions(
    Permission.COMERCIAL_COMISSAO_UPDATE,
    Permission.COMERCIAL_COMISSAO_CREATE,
  )
  @ApiOperation({
    summary: 'Salva incidência e trava da loja para uma base do vendedor',
  })
  @ApiResponse({ status: 200, type: ComercialComissaoPoliticaResponseDto })
  salvarPolitica(
    @Req() req: { user: Usuario },
    @Body() dto: SalvarComercialComissaoPoliticaDto,
  ): Promise<ComercialComissaoPoliticaResponseDto> {
    return this.service.salvarPolitica(req.user, dto);
  }

  @Post('carregar-padrao')
  @Permissions(Permission.COMERCIAL_COMISSAO_CREATE)
  @ApiOperation({
    summary: 'Carrega faixas padrão do vendedor (substitui as existentes)',
  })
  @ApiResponse({ status: 200, type: [ComercialComissaoFaixaItemDto] })
  carregarPadrao(
    @Req() req: { user: Usuario },
    @Body() dto: FindComercialComissaoFaixaDto,
  ): Promise<ComercialComissaoFaixaItemDto[]> {
    return this.service.carregarFaixasPadrao(
      req.user,
      dto.funcionarioId,
      dto.tipoBase,
    );
  }

  @Post('carregar-padrao-pendentes')
  @Permissions(Permission.COMERCIAL_COMISSAO_CREATE)
  @ApiOperation({
    summary:
      'Carrega faixas padrão apenas para vendedores da unidade sem faixas em cada base',
  })
  @ApiResponse({
    status: 200,
    type: CarregarComercialComissaoPadraoPendentesResponseDto,
  })
  carregarPadraoPendentes(
    @Req() req: { user: Usuario },
    @Body() dto: CarregarComercialComissaoPadraoPendentesDto,
  ): Promise<CarregarComercialComissaoPadraoPendentesResponseDto> {
    return this.service.carregarFaixasPadraoPendentes(req.user, dto.unidade);
  }

  @Post()
  @Permissions(Permission.COMERCIAL_COMISSAO_CREATE)
  @ApiOperation({ summary: 'Inclui faixa de comissão' })
  @ApiResponse({ status: 200, type: [ComercialComissaoFaixaItemDto] })
  criarFaixa(
    @Req() req: { user: Usuario },
    @Body() dto: SalvarComercialComissaoFaixaDto,
  ): Promise<ComercialComissaoFaixaItemDto[]> {
    return this.service.criarFaixa(req.user, dto);
  }

  @Patch(':id')
  @Permissions(Permission.COMERCIAL_COMISSAO_UPDATE)
  @ApiOperation({ summary: 'Altera faixa de comissão' })
  @ApiResponse({ status: 200, type: [ComercialComissaoFaixaItemDto] })
  atualizarFaixa(
    @Req() req: { user: Usuario },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SalvarComercialComissaoFaixaDto,
  ): Promise<ComercialComissaoFaixaItemDto[]> {
    return this.service.atualizarFaixa(req.user, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.COMERCIAL_COMISSAO_DELETE)
  @ApiOperation({ summary: 'Exclui faixa de comissão' })
  @ApiResponse({ status: 200, type: [ComercialComissaoFaixaItemDto] })
  excluirFaixa(
    @Req() req: { user: Usuario },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ComercialComissaoFaixaItemDto[]> {
    return this.service.excluirFaixa(req.user, id);
  }
}
