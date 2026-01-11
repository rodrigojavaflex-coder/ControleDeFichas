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
import { VendedoresService } from './vendedores.service';
import { CreateVendedorDto } from './dto/create-vendedor.dto';
import { UpdateVendedorDto } from './dto/update-vendedor.dto';
import { FindVendedoresDto } from './dto/find-vendedores.dto';
import { Vendedor } from './entities/vendedor.entity';
import { Permission } from '../../common/enums/permission.enum';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Vendedores')
@Controller('vendedores')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class VendedoresController {
  constructor(private readonly vendedoresService: VendedoresService) {}

  @Post()
  @Permissions(Permission.VENDEDOR_CREATE)
  @ApiOperation({ summary: 'Criar novo vendedor' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Vendedor criado com sucesso',
    type: Vendedor,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dados inválidos',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Vendedor já existe',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Permissão insuficiente',
  })
  create(@Body() createVendedorDto: CreateVendedorDto) {
    return this.vendedoresService.create(createVendedorDto);
  }

  @Get('search')
  @Permissions(Permission.VENDEDOR_READ)
  @ApiOperation({ summary: 'Buscar vendedores para autocomplete' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de vendedores encontrados',
    type: [Vendedor],
  })
  @ApiQuery({ name: 'nome', required: true, description: 'Nome para buscar (parcial)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limite de resultados (padrão: 20)' })
  async search(@Query('nome') nome: string, @Query('limit') limit?: number, @Req() req?: any) {
    const unidade = req?.user?.unidade;
    return this.vendedoresService.search(nome, unidade, limit ? Number(limit) : 20);
  }

  @Get()
  @Permissions(Permission.VENDEDOR_READ)
  @ApiOperation({ summary: 'Listar vendedores com paginação e filtros' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de vendedores recuperada com sucesso',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página' })
  @ApiQuery({ name: 'nome', required: false, description: 'Filtrar por nome' })
  @ApiQuery({ name: 'unidade', required: false, description: 'Filtrar por unidade' })
  findAll(@Query() findVendedoresDto: FindVendedoresDto) {
    return this.vendedoresService.findAll(findVendedoresDto);
  }

  @Get(':id')
  @Permissions(Permission.VENDEDOR_READ)
  @ApiOperation({ summary: 'Buscar vendedor por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vendedor encontrado',
    type: Vendedor,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Vendedor não encontrado',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendedoresService.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.VENDEDOR_UPDATE)
  @ApiOperation({ summary: 'Atualizar vendedor' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Vendedor atualizado com sucesso',
    type: Vendedor,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Vendedor não encontrado',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Dados duplicados',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Permissão insuficiente',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateVendedorDto: UpdateVendedorDto,
  ) {
    return this.vendedoresService.update(id, updateVendedorDto);
  }

  @Delete(':id')
  @Permissions(Permission.VENDEDOR_DELETE)
  @ApiOperation({ summary: 'Remover vendedor' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Vendedor removido com sucesso',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Vendedor não encontrado',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Permissão insuficiente',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendedoresService.remove(id);
  }
}

