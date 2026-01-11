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
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { FindClientesDto } from './dto/find-clientes.dto';
import { Cliente } from './entities/cliente.entity';
import { Permission } from '../../common/enums/permission.enum';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Clientes')
@Controller('clientes')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  @Permissions(Permission.CLIENTE_CREATE)
  @ApiOperation({ summary: 'Criar novo cliente' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Cliente criado com sucesso',
    type: Cliente,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dados inválidos',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Cliente já existe',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Permissão insuficiente',
  })
  create(@Body() createClienteDto: CreateClienteDto) {
    return this.clientesService.create(createClienteDto);
  }

  @Get('search')
  @Permissions(Permission.CLIENTE_READ)
  @ApiOperation({ summary: 'Buscar clientes para autocomplete' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de clientes encontrados',
    type: [Cliente],
  })
  @ApiQuery({ name: 'nome', required: true, description: 'Nome para buscar (parcial)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limite de resultados (padrão: 20)' })
  async search(@Query('nome') nome: string, @Query('limit') limit?: number, @Req() req?: any) {
    const unidade = req?.user?.unidade;
    return this.clientesService.search(nome, unidade, limit ? Number(limit) : 20);
  }

  @Get()
  @Permissions(Permission.CLIENTE_READ)
  @ApiOperation({ summary: 'Listar clientes com paginação e filtros' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de clientes recuperada com sucesso',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página' })
  @ApiQuery({ name: 'nome', required: false, description: 'Filtrar por nome' })
  @ApiQuery({ name: 'cpf', required: false, description: 'Filtrar por CPF' })
  @ApiQuery({ name: 'unidade', required: false, description: 'Filtrar por unidade' })
  findAll(@Query() findClientesDto: FindClientesDto) {
    return this.clientesService.findAll(findClientesDto);
  }

  @Get(':id')
  @Permissions(Permission.CLIENTE_READ)
  @ApiOperation({ summary: 'Buscar cliente por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cliente encontrado',
    type: Cliente,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cliente não encontrado',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientesService.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.CLIENTE_UPDATE)
  @ApiOperation({ summary: 'Atualizar cliente' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Cliente atualizado com sucesso',
    type: Cliente,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cliente não encontrado',
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
    @Body() updateClienteDto: UpdateClienteDto,
  ) {
    return this.clientesService.update(id, updateClienteDto);
  }

  @Delete(':id')
  @Permissions(Permission.CLIENTE_DELETE)
  @ApiOperation({ summary: 'Remover cliente' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Cliente removido com sucesso',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Cliente não encontrado',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Permissão insuficiente',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientesService.remove(id);
  }
}

