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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { TiposVisitaService } from './tipos-visita.service';
import { CreateTipoVisitaDto } from './dto/create-tipo-visita.dto';
import { UpdateTipoVisitaDto } from './dto/update-tipo-visita.dto';
import { TipoVisita } from './entities/tipo-visita.entity';

type ReqUsuario = { user: Usuario };

@ApiTags('Tipos de visita')
@Controller('tipos-visita')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class TiposVisitaController {
  constructor(private readonly service: TiposVisitaService) {}

  @Post()
  @Permissions(Permission.TIPOS_VISITA_CREATE)
  @ApiOperation({ summary: 'Criar tipo de visita' })
  @ApiResponse({ status: 201, type: TipoVisita })
  create(
    @Req() req: ReqUsuario,
    @Body() dto: CreateTipoVisitaDto,
  ): Promise<TipoVisita> {
    return this.service.create(req.user.id, dto);
  }

  @Get()
  @Permissions(Permission.TIPOS_VISITA_READ)
  @ApiOperation({ summary: 'Listar tipos de visita da unidade' })
  @ApiQuery({ name: 'apenasAtivos', required: false, type: Boolean })
  @ApiQuery({ name: 'unidade', required: false })
  @ApiResponse({ status: 200, type: [TipoVisita] })
  findAll(
    @Req() req: ReqUsuario,
    @Query('apenasAtivos') apenasAtivos?: string,
    @Query('unidade') unidade?: string,
  ): Promise<TipoVisita[]> {
    return this.service.findAll(req.user.id, {
      apenasAtivos: apenasAtivos === 'true',
      unidade,
    });
  }

  @Get(':id')
  @Permissions(Permission.TIPOS_VISITA_READ)
  @ApiOperation({ summary: 'Obter tipo de visita' })
  @ApiResponse({ status: 200, type: TipoVisita })
  findOne(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TipoVisita> {
    return this.service.findOne(req.user.id, id);
  }

  @Patch(':id')
  @Permissions(Permission.TIPOS_VISITA_UPDATE)
  @ApiOperation({ summary: 'Atualizar tipo de visita' })
  @ApiResponse({ status: 200, type: TipoVisita })
  update(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTipoVisitaDto,
  ): Promise<TipoVisita> {
    return this.service.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.TIPOS_VISITA_DELETE)
  @ApiOperation({ summary: 'Excluir tipo de visita' })
  @ApiResponse({ status: 200 })
  remove(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.remove(req.user.id, id);
  }
}
