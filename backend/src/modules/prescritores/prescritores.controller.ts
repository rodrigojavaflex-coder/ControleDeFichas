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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PrescritoresService } from './prescritores.service';
import { CreatePrescritorDto } from './dto/create-prescritor.dto';
import { UpdatePrescritorDto } from './dto/update-prescritor.dto';
import { FindPrescritoresDto } from './dto/find-prescritores.dto';
import { Prescritor } from './entities/prescritor.entity';
import { Permission } from '../../common/enums/permission.enum';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Prescritores')
@Controller('prescritores')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class PrescritoresController {
  constructor(private readonly prescritoresService: PrescritoresService) {}

  @Post()
  @Permissions(Permission.PRESCRITOR_CREATE)
  @ApiOperation({ summary: 'Criar novo prescritor' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Prescritor criado com sucesso',
    type: Prescritor,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dados inválidos',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Prescritor já existe',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Permissão insuficiente',
  })
  create(@Body() createPrescritorDto: CreatePrescritorDto) {
    return this.prescritoresService.create(createPrescritorDto);
  }

  @Get('search')
  @Permissions(Permission.PRESCRITOR_READ)
  @ApiOperation({ summary: 'Buscar prescritores para autocomplete' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de prescritores encontrados',
    type: [Prescritor],
  })
  @ApiQuery({ name: 'nome', required: true, description: 'Nome para buscar (parcial)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limite de resultados (padrão: 20)' })
  async search(@Query('nome') nome: string, @Query('limit') limit?: number) {
    return this.prescritoresService.search(nome, limit ? Number(limit) : 20);
  }

  @Get()
  @Permissions(Permission.PRESCRITOR_READ)
  @ApiOperation({ summary: 'Listar prescritores com paginação e filtros' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de prescritores recuperada com sucesso',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página' })
  @ApiQuery({ name: 'nome', required: false, description: 'Filtrar por nome' })
  @ApiQuery({ name: 'numeroCRM', required: false, description: 'Filtrar por número do CRM' })
  findAll(@Query() findPrescritoresDto: FindPrescritoresDto) {
    return this.prescritoresService.findAll(findPrescritoresDto);
  }

  @Get(':id')
  @Permissions(Permission.PRESCRITOR_READ)
  @ApiOperation({ summary: 'Buscar prescritor por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Prescritor encontrado',
    type: Prescritor,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Prescritor não encontrado',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescritoresService.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.PRESCRITOR_UPDATE)
  @ApiOperation({ summary: 'Atualizar prescritor' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Prescritor atualizado com sucesso',
    type: Prescritor,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Prescritor não encontrado',
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
    @Body() updatePrescritorDto: UpdatePrescritorDto,
  ) {
    return this.prescritoresService.update(id, updatePrescritorDto);
  }

  @Delete(':id')
  @Permissions(Permission.PRESCRITOR_DELETE)
  @ApiOperation({ summary: 'Remover prescritor' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Prescritor removido com sucesso',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Prescritor não encontrado',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Permissão insuficiente',
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescritoresService.remove(id);
  }
}

