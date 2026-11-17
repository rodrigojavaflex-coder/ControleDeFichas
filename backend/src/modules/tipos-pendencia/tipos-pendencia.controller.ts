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
import { CreateTipoPendenciaDto } from './dto/create-tipo-pendencia.dto';
import { UpdateTipoPendenciaDto } from './dto/update-tipo-pendencia.dto';
import { TiposPendenciaService } from './tipos-pendencia.service';
import {
  ResponsavelTipoPendenciaOpcao,
  TipoPendenciaItem,
  TipoPendenciaOpcao,
} from './tipos-pendencia.types';

type ReqUsuario = { user: Usuario };

@ApiTags('Tipos de pendência')
@Controller('tipos-pendencia')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class TiposPendenciaController {
  constructor(private readonly service: TiposPendenciaService) {}

  @Post()
  @Permissions(Permission.TIPOS_PENDENCIA_CREATE)
  @ApiOperation({ summary: 'Criar tipo de pendência' })
  @ApiResponse({ status: 201 })
  create(
    @Req() req: ReqUsuario,
    @Body() dto: CreateTipoPendenciaDto,
  ): Promise<TipoPendenciaItem> {
    return this.service.create(req.user.id, dto);
  }

  @Get('ativos')
  @Permissions(
    Permission.TIPOS_PENDENCIA_READ,
    Permission.PENDENCIAS_CREATE,
    Permission.PENDENCIAS_READ,
    Permission.VISITAS_UPDATE,
  )
  @ApiOperation({ summary: 'Tipos ativos da unidade do visitador' })
  @ApiResponse({ status: 200 })
  ativos(@Req() req: ReqUsuario): Promise<TipoPendenciaOpcao[]> {
    return this.service.listarAtivos(req.user.id);
  }

  @Get('responsaveis')
  @Permissions(
    Permission.TIPOS_PENDENCIA_CREATE,
    Permission.TIPOS_PENDENCIA_UPDATE,
  )
  @ApiOperation({ summary: 'Usuários ativos para responsável do tipo' })
  @ApiResponse({ status: 200 })
  responsaveis(): Promise<ResponsavelTipoPendenciaOpcao[]> {
    return this.service.listarResponsaveis();
  }

  @Get()
  @Permissions(Permission.TIPOS_PENDENCIA_READ)
  @ApiOperation({ summary: 'Listar tipos de pendência' })
  @ApiQuery({ name: 'apenasAtivos', required: false, type: Boolean })
  @ApiQuery({ name: 'unidade', required: false })
  @ApiResponse({ status: 200 })
  findAll(
    @Req() req: ReqUsuario,
    @Query('apenasAtivos') apenasAtivos?: string,
    @Query('unidade') unidade?: string,
  ): Promise<TipoPendenciaItem[]> {
    return this.service.findAll(req.user.id, {
      apenasAtivos: apenasAtivos === 'true',
      unidade,
    });
  }

  @Get(':id')
  @Permissions(Permission.TIPOS_PENDENCIA_READ)
  @ApiOperation({ summary: 'Obter tipo de pendência' })
  @ApiResponse({ status: 200 })
  findOne(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TipoPendenciaItem> {
    return this.service.findOne(req.user.id, id);
  }

  @Patch(':id')
  @Permissions(Permission.TIPOS_PENDENCIA_UPDATE)
  @ApiOperation({ summary: 'Atualizar tipo de pendência' })
  @ApiResponse({ status: 200 })
  update(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTipoPendenciaDto,
  ): Promise<TipoPendenciaItem> {
    return this.service.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.TIPOS_PENDENCIA_DELETE)
  @ApiOperation({ summary: 'Excluir tipo de pendência' })
  @ApiResponse({ status: 200 })
  remove(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.remove(req.user.id, id);
  }
}
