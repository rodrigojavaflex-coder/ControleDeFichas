import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OrcamentoMotivosRejeicaoService } from './orcamento-motivos-rejeicao.service';
import { CreateOrcamentoMotivoRejeicaoDto } from './dto/create-orcamento-motivo-rejeicao.dto';
import { UpdateOrcamentoMotivoRejeicaoDto } from './dto/update-orcamento-motivo-rejeicao.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';

@ApiTags('Orçamentos — Motivos de rejeição')
@Controller('orcamentos-motivos-rejeicao')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class OrcamentoMotivosRejeicaoController {
  constructor(private readonly service: OrcamentoMotivosRejeicaoService) {}

  @Post()
  @Permissions(Permission.ORCAMENTO_MOTIVO_CREATE)
  @ApiOperation({ summary: 'Criar motivo de rejeição' })
  create(@Body() dto: CreateOrcamentoMotivoRejeicaoDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions(
    Permission.ORCAMENTO_MOTIVO_READ,
    Permission.ORCAMENTO_REJEITADO_READ,
    Permission.ORCAMENTO_REJEITADO_UPDATE,
  )
  @ApiOperation({ summary: 'Listar motivos de rejeição' })
  @ApiQuery({ name: 'apenasAtivos', required: false, type: Boolean })
  findAll(@Query('apenasAtivos') apenasAtivos?: string) {
    const filtrarAtivos = apenasAtivos === 'true';
    return this.service.findAll(filtrarAtivos ? true : undefined);
  }

  @Get(':id')
  @Permissions(Permission.ORCAMENTO_MOTIVO_READ)
  @ApiOperation({ summary: 'Obter motivo de rejeição por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.ORCAMENTO_MOTIVO_UPDATE)
  @ApiOperation({ summary: 'Atualizar motivo de rejeição' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrcamentoMotivoRejeicaoDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.ORCAMENTO_MOTIVO_DELETE)
  @ApiOperation({ summary: 'Excluir motivo de rejeição' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
