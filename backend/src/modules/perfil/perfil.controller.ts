import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PerfilService } from './perfil.service';
import { CreatePerfilDto } from './dto/create-perfil.dto';
import { UpdatePerfilDto } from './dto/update-perfil.dto';
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
  @Permissions(Permission.PROFILE_READ)
  @ApiOperation({ summary: 'Listar todos os perfis' })
  @ApiResponse({ status: 200, description: 'Perfis listados' })
  findAll() {
    return this.perfilService.findAll();
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
  getPrintData(
    @Param('id', ParseUUIDPipe) id: string
  ) {
    return this.perfilService.getPrintData(id);
  }
}