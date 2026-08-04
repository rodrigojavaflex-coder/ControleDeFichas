import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PerfilService } from './perfil.service';
import { CreatePerfilDto } from './dto/create-perfil.dto';
import { UpdatePerfilDto } from './dto/update-perfil.dto';
import { VincularUsuariosPerfilDto } from './dto/vincular-usuarios-perfil.dto';
import { DesvincularUsuariosPerfilDto } from './dto/desvincular-usuarios-perfil.dto';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('perfil')
@Controller('perfil')
export class PerfilController {
  constructor(private readonly perfilService: PerfilService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.PROFILE_CREATE)
  @ApiOperation({ summary: 'Criar novo perfil' })
  @ApiResponse({ status: 201, description: 'Perfil criado' })
  create(@Body() createPerfilDto: CreatePerfilDto) {
    return this.perfilService.create(createPerfilDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(
    Permission.PROFILE_READ,
    Permission.PROFILE_ASSIGN_USERS,
    Permission.PROFILE_UNASSIGN_USERS,
  )
  @ApiOperation({ summary: 'Listar todos os perfis' })
  @ApiResponse({ status: 200, description: 'Perfis listados' })
  findAll() {
    return this.perfilService.findAll();
  }

  @Post(':id/vincular-usuarios')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.PROFILE_ASSIGN_USERS)
  @ApiOperation({ summary: 'Vincular usuários ao perfil' })
  @ApiResponse({ status: 200, description: 'Perfil atualizado com estatísticas' })
  @ApiResponse({ status: 400, description: 'Usuário inválido ou não encontrado' })
  @ApiResponse({ status: 404, description: 'Perfil não encontrado' })
  vincularUsuarios(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VincularUsuariosPerfilDto,
  ) {
    return this.perfilService.vincularUsuarios(id, dto.usuarioIds);
  }

  @Post(':id/desvincular-usuarios')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.PROFILE_UNASSIGN_USERS)
  @ApiOperation({ summary: 'Desvincular usuários do perfil' })
  @ApiResponse({ status: 200, description: 'Perfil atualizado com estatísticas' })
  @ApiResponse({
    status: 400,
    description: 'Usuário não vinculado ou último perfil do usuário',
  })
  @ApiResponse({ status: 404, description: 'Perfil não encontrado' })
  desvincularUsuarios(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DesvincularUsuariosPerfilDto,
  ) {
    return this.perfilService.desvincularUsuarios(id, dto.usuarioIds);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.PROFILE_READ)
  @ApiOperation({ summary: 'Buscar perfil por id' })
  @ApiResponse({ status: 200, description: 'Perfil encontrado' })
  findOne(@Param('id') id: string) {
    return this.perfilService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.PROFILE_UPDATE)
  @ApiOperation({ summary: 'Atualizar perfil existente' })
  @ApiResponse({ status: 200, description: 'Perfil atualizado' })
  update(@Param('id') id: string, @Body() updatePerfilDto: UpdatePerfilDto) {
    return this.perfilService.update(id, updatePerfilDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.PROFILE_DELETE)
  @ApiOperation({ summary: 'Excluir perfil' })
  @ApiResponse({ status: 204, description: 'Perfil excluído' })
  remove(@Param('id') id: string) {
    return this.perfilService.remove(id);
  }

  @Get(':id/print')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.PROFILE_READ)
  @ApiOperation({ summary: 'Buscar dados do perfil formatados para impressão' })
  @ApiResponse({ status: 200, description: 'Dados do perfil para impressão' })
  @ApiResponse({ status: 404, description: 'Perfil não encontrado' })
  getPrintData(@Param('id', ParseUUIDPipe) id: string) {
    return this.perfilService.getPrintData(id);
  }
}
