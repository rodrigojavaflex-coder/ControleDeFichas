import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  HttpStatus,
  ValidationPipe,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { FichaTecnicaService } from './ficha-tecnica.service';
import { CreateFichaTecnicaDto, UpdateFichaTecnicaDto, FindFichaTecnicaDto } from './dto';
import { FichaTecnica } from './entities/ficha-tecnica.entity';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { AuditAction } from '../../common/enums/audit.enum';
import { AuditLog, AuditInterceptor } from '../../common/interceptors/audit.interceptor';

@ApiTags('fichas-tecnicas')
@Controller('fichas-tecnicas')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@UseInterceptors(AuditInterceptor)
export class FichaTecnicaController {
  constructor(private readonly fichaTecnicaService: FichaTecnicaService) {}

  @Post()
  @Permissions(Permission.FICHA_TECNICA_CREATE)
  @AuditLog(AuditAction.FICHA_TECNICA_CREATE, 'FichaTecnica')
  @ApiOperation({ summary: 'Criar nova ficha técnica' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Ficha técnica criada com sucesso',
    type: FichaTecnica,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dados inválidos',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Permissão insuficiente',
  })
  async create(@Body() createFichaTecnicaDto: CreateFichaTecnicaDto): Promise<FichaTecnica> {
    return await this.fichaTecnicaService.create(createFichaTecnicaDto);
  }

  @Get()
  @Permissions(Permission.FICHA_TECNICA_READ)
  @ApiOperation({ summary: 'Listar fichas técnicas com paginação e filtros' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de fichas técnicas',
    type: PaginatedResponseDto<FichaTecnica>,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Número da página (padrão: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Itens por página (padrão: 10)',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Busca geral em múltiplos campos',
    example: 'paracetamol',
  })
  @ApiQuery({
    name: 'produto',
    required: false,
    type: String,
    description: 'Filtrar por produto',
    example: 'Paracetamol',
  })
  @ApiQuery({
    name: 'dcb',
    required: false,
    type: String,
    description: 'Filtrar por DCB',
    example: 'Paracetamol',
  })
  async findAll(@Query(ValidationPipe) query: FindFichaTecnicaDto): Promise<PaginatedResponseDto<FichaTecnica>> {
    return await this.fichaTecnicaService.findAll(query);
  }

  @Get('count')
  @Permissions(Permission.FICHA_TECNICA_READ)
  @ApiOperation({ summary: 'Contar total de fichas técnicas' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Total de fichas técnicas',
    schema: { type: 'object', properties: { count: { type: 'number' } } },
  })
  async count(): Promise<{ count: number }> {
    const count = await this.fichaTecnicaService.count();
    return { count };
  }

  @Get('recent')
  @Permissions(Permission.FICHA_TECNICA_READ)
  @ApiOperation({ summary: 'Obter fichas técnicas mais recentes' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Número de fichas a retornar (padrão: 5)',
    example: 5,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Fichas técnicas mais recentes',
    type: [FichaTecnica],
  })
  async findRecent(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number): Promise<FichaTecnica[]> {
    return await this.fichaTecnicaService.findRecentFichas(limit || 5);
  }

  @Get(':id')
  @Permissions(Permission.FICHA_TECNICA_READ)
  @AuditLog(AuditAction.FICHA_TECNICA_READ, 'FichaTecnica')
  @ApiOperation({ summary: 'Buscar ficha técnica por ID' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID da ficha técnica',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Ficha técnica encontrada',
    type: FichaTecnica,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Ficha técnica não encontrada',
  })
  async findOne(@Param('id') id: string): Promise<FichaTecnica> {
    return await this.fichaTecnicaService.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.FICHA_TECNICA_UPDATE)
  @AuditLog(AuditAction.FICHA_TECNICA_UPDATE, 'FichaTecnica')
  @ApiOperation({ summary: 'Atualizar ficha técnica' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID da ficha técnica',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Ficha técnica atualizada com sucesso',
    type: FichaTecnica,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Ficha técnica não encontrada',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Permissão insuficiente',
  })
  async update(
    @Param('id') id: string,
    @Body() updateFichaTecnicaDto: UpdateFichaTecnicaDto,
  ): Promise<FichaTecnica> {
    return await this.fichaTecnicaService.update(id, updateFichaTecnicaDto);
  }

  @Delete(':id')
  @Permissions(Permission.FICHA_TECNICA_DELETE)
  @AuditLog(AuditAction.FICHA_TECNICA_DELETE, 'FichaTecnica')
  @ApiOperation({ summary: 'Remover ficha técnica' })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'ID da ficha técnica',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Ficha técnica removida com sucesso',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Ficha técnica não encontrada',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Permissão insuficiente',
  })
  async remove(@Param('id') id: string): Promise<void> {
    return await this.fichaTecnicaService.remove(id);
  }
}