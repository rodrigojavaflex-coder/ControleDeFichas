import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpStatus,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { VendasService } from './vendas.service';
import { CreateVendaDto } from './dto/create-venda.dto';
import { UpdateVendaDto } from './dto/update-venda.dto';
import { FindVendasDto } from './dto/find-vendas.dto';
import { Venda } from './entities/venda.entity';
import { Permission } from '../../common/enums/permission.enum';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { FecharVendasEmMassaDto } from './dto/fechar-vendas-em-massa.dto';
import { CancelarFechamentosEmMassaDto } from './dto/cancelar-fechamentos-em-massa.dto';
import { RegistrarEnvioDto } from './dto/registrar-envio.dto';
import { AtualizarValorCompraDto } from './dto/atualizar-valor-compra.dto';
import { EditarValoresFechamentoDto } from './dto/editar-valores-fechamento.dto';
import { ConfirmarImportacaoRpsDto } from './dto/confirmar-importacao-rps.dto';
import { AuditLog } from '../../common/interceptors/auditoria.interceptor';
import { AuditAction } from '../../common/enums/auditoria.enum';

@ApiTags('Vendas')
@Controller('vendas')
@ApiBearerAuth()
export class VendasController {
  constructor(private readonly vendasService: VendasService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_CREATE)
  @ApiOperation({ summary: 'Criar nova venda' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Venda criada com sucesso',
    type: Venda,
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Protocolo já existe',
  })
  create(
    @Body() createVendaDto: CreateVendaDto,
    @Req() req: any,
  ): Promise<Venda> {
    return this.vendasService.create(createVendaDto, req?.user);
  }

  @Post('fechamento-massa')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_FECHAR)
  @ApiOperation({ summary: 'Fechar vendas em massa' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Processamento concluído',
  })
  fecharVendasEmMassa(
    @Body() fecharVendasDto: FecharVendasEmMassaDto,
  ): Promise<{ sucesso: Venda[]; falhas: { id: string; motivo: string }[] }> {
    return this.vendasService.fecharVendasEmMassa(fecharVendasDto);
  }

  @Post('cancelamento-massa')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_CANCELAR_FECHAMENTO)
  @ApiOperation({ summary: 'Cancelar fechamento de vendas em massa' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Processamento concluído',
  })
  cancelarFechamentosEmMassa(
    @Body() cancelarDto: CancelarFechamentosEmMassaDto,
  ): Promise<{ sucesso: Venda[]; falhas: { id: string; motivo: string }[] }> {
    return this.vendasService.cancelarFechamentosEmMassa(cancelarDto);
  }

  @Post('atualizar-valor-compra-massa')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_UPDATE)
  @ApiOperation({ summary: 'Atualizar valor de compra em massa via agente' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Valores de compra atualizados com sucesso',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Nenhuma venda encontrada',
  })
  atualizarValorCompraEmMassa(
    @Body() dto: AtualizarValorCompraDto,
  ): Promise<{ sucesso: Venda[]; falhas: { id: string; motivo: string }[] }> {
    return this.vendasService.atualizarValorCompraEmMassa(dto);
  }

  @Post('registrar-envio')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_UPDATE, Permission.VENDA_ACOMPANHAR)
  @AuditLog(AuditAction.UPDATE, 'vendas')
  @ApiOperation({ summary: 'Registrar data de envio em massa' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Data de envio registrada',
  })
  registrarEnvio(
    @Body() registrarEnvioDto: RegistrarEnvioDto,
  ): Promise<{ sucesso: Venda[]; falhas: { id: string; motivo: string }[] }> {
    return this.vendasService.registrarEnvioEmMassa(registrarEnvioDto);
  }

  @Post('importar-rps/preview')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_IMPORTAR_RPS_FECHAMENTO)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Preview da importação de RPS (atualiza V. Fechamento / valorPago)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Preview gerado' })
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: memoryStorage(),
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  previewImportacaoRps(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: { user: Usuario },
  ) {
    if (!files?.length) {
      throw new BadRequestException('Envie ao menos um arquivo PDF de RPS');
    }
    return this.vendasService.previewImportacaoRps(files, req.user);
  }

  @Post('importar-rps/confirmar')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_IMPORTAR_RPS_FECHAMENTO)
  @AuditLog(AuditAction.UPDATE, 'vendas')
  @ApiOperation({
    summary: 'Confirmar importação de RPS (grava valorPago nas vendas abertas)',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Processamento concluído' })
  confirmarImportacaoRps(
    @Body() dto: ConfirmarImportacaoRpsDto,
    @Req() req: { user: Usuario },
  ): Promise<{ sucesso: Venda[]; falhas: { id: string; motivo: string }[] }> {
    return this.vendasService.confirmarImportacaoRps(dto, req.user);
  }

  @Patch(':id/valores-fechamento')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_EDITAR_VALOR_COMPRA)
  @AuditLog(AuditAction.UPDATE, 'vendas')
  @ApiOperation({
    summary:
      'Editar V. Compra e/ou V. Fechamento de venda sem data de fechamento',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Valores atualizados' })
  editarValoresFechamento(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EditarValoresFechamentoDto,
    @Req() req: { user: Usuario },
  ): Promise<Venda> {
    return this.vendasService.editarValoresFechamento(id, dto, req.user);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_READ, Permission.VENDA_ANALISE_VALORES)
  @ApiOperation({ summary: 'Listar vendas com paginação e filtros' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de vendas retornada com sucesso',
    type: PaginatedResponseDto<Venda>,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'protocolo', required: false, type: String })
  @ApiQuery({ name: 'cliente', required: false, type: String })
  @ApiQuery({ name: 'origem', required: false, type: String })
  @ApiQuery({ name: 'vendedor', required: false, type: String })
  @ApiQuery({ name: 'prescritor', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'dataInicial', required: false, type: String })
  @ApiQuery({ name: 'dataFinal', required: false, type: String })
  @ApiQuery({ name: 'dataInicialFechamento', required: false, type: String })
  @ApiQuery({ name: 'dataFinalFechamento', required: false, type: String })
  @ApiQuery({ name: 'dataInicialEnvio', required: false, type: String })
  @ApiQuery({ name: 'dataFinalEnvio', required: false, type: String })
  @ApiQuery({ name: 'dataInicialBaixa', required: false, type: String })
  @ApiQuery({ name: 'dataFinalBaixa', required: false, type: String })
  @ApiQuery({ name: 'unidade', required: false, type: String })
  @ApiQuery({ name: 'ativo', required: false, type: String })
  findAll(
    @Query() findVendasDto: FindVendasDto,
    @Req() req: { user: Usuario },
  ): Promise<PaginatedResponseDto<Venda>> {
    return this.vendasService.findAll(findVendasDto, req.user);
  }

  @Get('acompanhar')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_ACOMPANHAR)
  @ApiOperation({
    summary: 'Listar vendas para acompanhamento por unidade de origem',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de vendas retornada com sucesso',
    type: PaginatedResponseDto<Venda>,
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'protocolo', required: false, type: String })
  @ApiQuery({ name: 'cliente', required: false, type: String })
  @ApiQuery({ name: 'origem', required: false, type: String })
  @ApiQuery({ name: 'vendedor', required: false, type: String })
  @ApiQuery({ name: 'prescritor', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'dataInicial', required: false, type: String })
  @ApiQuery({ name: 'dataFinal', required: false, type: String })
  @ApiQuery({ name: 'dataInicialFechamento', required: false, type: String })
  @ApiQuery({ name: 'dataFinalFechamento', required: false, type: String })
  @ApiQuery({ name: 'dataInicialEnvio', required: false, type: String })
  @ApiQuery({ name: 'dataFinalEnvio', required: false, type: String })
  @ApiQuery({ name: 'dataInicialBaixa', required: false, type: String })
  @ApiQuery({ name: 'dataFinalBaixa', required: false, type: String })
  @ApiQuery({ name: 'unidade', required: false, type: String })
  @ApiQuery({ name: 'ativo', required: false, type: String })
  findAcompanhar(
    @Query() findVendasDto: FindVendasDto,
    @Req() req: any,
  ): Promise<PaginatedResponseDto<Venda>> {
    return this.vendasService.findAcompanhar(findVendasDto, req?.user);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_READ)
  @ApiOperation({ summary: 'Buscar venda por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Venda encontrada',
    type: Venda,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Venda não encontrada',
  })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: Usuario },
  ): Promise<Venda> {
    return this.vendasService.findOne(id, req.user);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_UPDATE)
  @ApiOperation({ summary: 'Atualizar venda' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Venda atualizada com sucesso',
    type: Venda,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Venda não encontrada',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Protocolo já existe',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateVendaDto: UpdateVendaDto,
    @Req() req: any,
  ): Promise<Venda> {
    return this.vendasService.update(id, updateVendaDto, req?.user);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_DELETE)
  @ApiOperation({ summary: 'Remover venda' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Venda removida com sucesso',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Venda não encontrada',
  })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.vendasService.remove(id);
  }
}
