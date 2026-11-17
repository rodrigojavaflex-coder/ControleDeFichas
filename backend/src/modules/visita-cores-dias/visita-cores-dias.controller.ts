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
import { Permission } from '../../common/enums/permission.enum';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CreateVisitaCorDiaDto } from './dto/create-visita-cor-dia.dto';
import { UpdateVisitaCorDiaDto } from './dto/update-visita-cor-dia.dto';
import { VisitaCorDia } from './entities/visita-cor-dia.entity';
import { VisitaCoresDiasService } from './visita-cores-dias.service';

type ReqUsuario = { user: Usuario };

@ApiTags('Cores dos dias da visita')
@Controller('visita-cores-dias')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class VisitaCoresDiasController {
  constructor(private readonly service: VisitaCoresDiasService) {}

  @Post()
  @Permissions(Permission.VISITA_COR_DIAS_CREATE)
  @ApiOperation({ summary: 'Criar faixa de cor dos dias da visita' })
  @ApiResponse({ status: 201, type: VisitaCorDia })
  @ApiResponse({ status: 409, description: 'Já existe faixa para este limite' })
  create(
    @Req() req: ReqUsuario,
    @Body() dto: CreateVisitaCorDiaDto,
  ): Promise<VisitaCorDia> {
    return this.service.create(req.user.id, dto);
  }

  @Get('ativas')
  @Permissions(
    Permission.VISITA_COR_DIAS_READ,
    Permission.VISITAS_READ,
    Permission.VISITAS_AGENDA_READ,
  )
  @ApiOperation({
    summary: 'Faixas ativas da unidade do visitador para colorir os dias',
  })
  @ApiResponse({ status: 200, type: [VisitaCorDia] })
  ativas(@Req() req: ReqUsuario): Promise<VisitaCorDia[]> {
    return this.service.findAtivas(req.user.id);
  }

  @Get()
  @Permissions(Permission.VISITA_COR_DIAS_READ)
  @ApiOperation({ summary: 'Listar faixas de cor dos dias da visita' })
  @ApiQuery({ name: 'unidade', required: false })
  @ApiResponse({ status: 200, type: [VisitaCorDia] })
  findAll(
    @Req() req: ReqUsuario,
    @Query('unidade') unidade?: string,
  ): Promise<VisitaCorDia[]> {
    return this.service.findAll(req.user.id, unidade);
  }

  @Get(':id')
  @Permissions(Permission.VISITA_COR_DIAS_READ)
  @ApiOperation({ summary: 'Obter faixa de cor' })
  @ApiResponse({ status: 200, type: VisitaCorDia })
  findOne(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VisitaCorDia> {
    return this.service.findOne(req.user.id, id);
  }

  @Patch(':id')
  @Permissions(Permission.VISITA_COR_DIAS_UPDATE)
  @ApiOperation({ summary: 'Atualizar faixa de cor' })
  @ApiResponse({ status: 200, type: VisitaCorDia })
  update(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVisitaCorDiaDto,
  ): Promise<VisitaCorDia> {
    return this.service.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.VISITA_COR_DIAS_DELETE)
  @ApiOperation({ summary: 'Excluir faixa de cor' })
  @ApiResponse({ status: 200 })
  remove(
    @Req() req: ReqUsuario,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.remove(req.user.id, id);
  }
}
