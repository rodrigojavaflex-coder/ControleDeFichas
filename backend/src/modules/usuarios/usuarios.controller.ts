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
  ConflictException,
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
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { FindUsuariosDto } from './dto/find-usuarios.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Usuario } from './entities/usuario.entity';
import type { Request } from 'express';
import {
  PERMISSION_GROUPS,
  Permission,
} from '../../common/enums/permission.enum';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Perfil } from '../perfil/entities/perfil.entity';

@ApiTags('Usuários')
@Controller('users')
@ApiBearerAuth()
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.USER_CREATE)
  @ApiOperation({ summary: 'Criar novo usuário' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Usuário criado com sucesso',
    type: Usuario,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dados inválidos',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Sem permissão para criar usuários',
  })
  create(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.create(createUsuarioDto);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Listar todas as permissões disponíveis' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de permissões agrupadas por categoria',
  })
  getPermissions() {
    return PERMISSION_GROUPS;
  }
  
  @Get('profiles')
  @ApiOperation({ summary: 'Listar perfis disponíveis' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de perfis retornada com sucesso',
    type: [Perfil],
  })
  getProfiles(): Promise<Perfil[]> {
    return this.usuariosService.getProfiles();
  }
  

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.USER_READ)
  @ApiOperation({ summary: 'Listar usuários com paginação e filtros' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de usuários recuperada com sucesso',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Sem permissão para visualizar usuários',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página' })
  @ApiQuery({ name: 'name', required: false, description: 'Filtrar por nome' })
  @ApiQuery({
    name: 'email',
    required: false,
    description: 'Filtrar por email',
  })
  findAll(@Query() findUsuariosDto: FindUsuariosDto) {
    return this.usuariosService.findAll(findUsuariosDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usuário encontrado',
    type: Usuario,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Usuário não encontrado',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.findOne(id);
  }

  @Get(':id/print')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.USER_PRINT)
  @ApiOperation({
    summary: 'Buscar dados do usuário formatados para impressão',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Dados do usuário para impressão',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Usuário não encontrado',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Sem permissão para imprimir usuários',
  })
  getPrintData(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.getPrintData(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.USER_UPDATE)
  @ApiOperation({ summary: 'Atualizar usuário' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usuário atualizado com sucesso',
    type: Usuario,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Usuário não encontrado',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Sem permissão para editar usuários',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
    @Req() req: Request,
  ) {
    // Capturar dados anteriores para auditoria
    const previousUser = await this.usuariosService.findOne(id);
    (req as any).previousUserData = previousUser;

    return this.usuariosService.update(id, updateUsuarioDto);
  }

  @Patch(':id/tema')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Atualizar tema do usuário' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Tema atualizado com sucesso',
    type: Usuario,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Usuário não encontrado',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Tema inválido',
  })
  async updateTema(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('tema') tema: string,
    @Req() req: Request,
  ) {
    // Capturar dados anteriores para auditoria
    const previousUser = await this.usuariosService.findOne(id);
    (req as any).previousUserData = previousUser;

    return this.usuariosService.updateTema(id, tema);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.USER_DELETE)
  @ApiOperation({ summary: 'Remover usuário' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'Usuário removido com sucesso',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Usuário não encontrado',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Sem permissão para excluir usuários',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    // Buscar usuário antes da deleção para auditoria
    const user = await this.usuariosService.findOne(id);
    (req as any).entityToDelete = user;

    return this.usuariosService.remove(id);
  }

  @Post(':id/change-password')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Alterar senha do usuário' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Senha alterada com sucesso',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dados inválidos ou senhas não conferem',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Usuário não encontrado',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Senha atual incorreta',
  })
  async changePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<void> {
    if (changePasswordDto.newPassword !== changePasswordDto.confirmPassword) {
      throw new ConflictException('As senhas não conferem');
    }

    return this.usuariosService.changePassword(
      id,
      changePasswordDto.currentPassword,
      changePasswordDto.newPassword,
    );
  }
}
