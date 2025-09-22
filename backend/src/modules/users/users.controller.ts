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
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FindUsersDto } from './dto/find-users.dto';
import { User } from './entities/user.entity';
import { PERMISSION_GROUPS, Permission } from '../../common/enums/permission.enum';
import { AuditAction } from '../../common/enums/audit.enum';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AuditLog, AuditInterceptor } from '../../common/interceptors/audit.interceptor';

@ApiTags('Usuários')
@Controller('users')
@ApiBearerAuth()
@UseInterceptors(AuditInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.USER_CREATE)
  @AuditLog(AuditAction.USER_CREATE, 'User')
  @ApiOperation({ summary: 'Criar novo usuário' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Usuário criado com sucesso',
    type: User,
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Dados inválidos' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Sem permissão para criar usuários' 
  })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
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
    description: 'Sem permissão para visualizar usuários' 
  })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página' })
  @ApiQuery({ name: 'name', required: false, description: 'Filtrar por nome' })
  @ApiQuery({ name: 'email', required: false, description: 'Filtrar por email' })
  findAll(@Query() findUsersDto: FindUsersDto) {
    return this.usersService.findAll(findUsersDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar usuário por ID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Usuário encontrado',
    type: User,
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Usuário não encontrado' 
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Get(':id/print')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.USER_PRINT)
  @AuditLog(AuditAction.USER_PRINT, 'User')
  @ApiOperation({ summary: 'Buscar dados do usuário formatados para impressão' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Dados do usuário para impressão',
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Usuário não encontrado' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Sem permissão para imprimir usuários' 
  })
  getPrintData(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getPrintData(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.USER_UPDATE)
  @AuditLog(AuditAction.USER_UPDATE, 'User')
  @ApiOperation({ summary: 'Atualizar usuário' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Usuário atualizado com sucesso',
    type: User,
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Usuário não encontrado' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Sem permissão para editar usuários' 
  })
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.USER_DELETE)
  @AuditLog(AuditAction.USER_DELETE, 'User')
  @ApiOperation({ summary: 'Remover usuário' })
  @ApiResponse({ 
    status: HttpStatus.NO_CONTENT, 
    description: 'Usuário removido com sucesso' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Usuário não encontrado' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Sem permissão para excluir usuários' 
  })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
