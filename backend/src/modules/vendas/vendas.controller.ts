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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { VendasService } from './vendas.service';
import { CreateVendaDto } from './dto/create-venda.dto';
import { UpdateVendaDto } from './dto/update-venda.dto';
import { FindVendasDto } from './dto/find-vendas.dto';
import { Venda } from './entities/venda.entity';
import { Permission } from '../../common/enums/permission.enum';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { FecharVendasEmMassaDto } from './dto/fechar-vendas-em-massa.dto';
import { CancelarFechamentosEmMassaDto } from './dto/cancelar-fechamentos-em-massa.dto';

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
  create(@Body() createVendaDto: CreateVendaDto, @Req() req: any): Promise<Venda> {
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

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_READ)
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
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'dataInicial', required: false, type: String })
  @ApiQuery({ name: 'dataFinal', required: false, type: String })
  @ApiQuery({ name: 'dataInicialFechamento', required: false, type: String })
  @ApiQuery({ name: 'dataFinalFechamento', required: false, type: String })
  @ApiQuery({ name: 'unidade', required: false, type: String })
  @ApiQuery({ name: 'ativo', required: false, type: String })
  findAll(@Query() findVendasDto: FindVendasDto): Promise<PaginatedResponseDto<Venda>> {
    return this.vendasService.findAll(findVendasDto);
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
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Venda> {
    return this.vendasService.findOne(id);
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
