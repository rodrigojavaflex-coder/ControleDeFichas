import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CertificadoService } from './certificado.service';
import { CreateCertificadoDto } from './dto/create-certificado.dto';
import { UpdateCertificadoDto } from './dto/update-certificado.dto';
import { Certificado } from './entities/certificado.entity';
import {
  PERMISSION_GROUPS,
  Permission,
} from '../../common/enums/permission.enum';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Certificados')
@Controller('certificados')
@ApiBearerAuth()
export class CertificadoController {
  constructor(private readonly certificadoService: CertificadoService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.CERTIFICADO_CREATE)
  @ApiOperation({ summary: 'Criar novo certificado' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Certificado criado com sucesso',
    type: Certificado,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dados inválidos',
  })
  create(@Body() createCertificadoDto: CreateCertificadoDto): Promise<Certificado> {
    return this.certificadoService.create(createCertificadoDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.CERTIFICADO_READ)
  @ApiOperation({ summary: 'Listar todos os certificados' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Lista de certificados retornada com sucesso',
    type: [Certificado],
  })
  findAll(): Promise<Certificado[]> {
    return this.certificadoService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.CERTIFICADO_READ)
  @ApiOperation({ summary: 'Buscar certificado por ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Certificado encontrado',
    type: Certificado,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Certificado não encontrado',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Certificado> {
    return this.certificadoService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.CERTIFICADO_UPDATE)
  @ApiOperation({ summary: 'Atualizar certificado' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Certificado atualizado com sucesso',
    type: Certificado,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Certificado não encontrado',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Dados inválidos',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCertificadoDto: UpdateCertificadoDto,
  ): Promise<Certificado> {
    return this.certificadoService.update(id, updateCertificadoDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.CERTIFICADO_DELETE)
  @ApiOperation({ summary: 'Remover certificado' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Certificado removido com sucesso',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Certificado não encontrado',
  })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.certificadoService.remove(id);
  }
  
  @Get('by-ficha/:fichaTecnicaId')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.CERTIFICADO_READ)
  @ApiOperation({ summary: 'Listar certificados por ficha técnica' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Lista de certificados', type: [Certificado] })
  findByFicha(
    @Param('fichaTecnicaId', ParseUUIDPipe) fichaTecnicaId: string,
  ): Promise<Certificado[]> {
    return this.certificadoService.findByFichaTecnica(fichaTecnicaId);
  }
}