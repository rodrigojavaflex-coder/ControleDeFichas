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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FolhaTiposService } from './folha-tipos.service';
import { CreateFolhaTipoDto } from './dto/create-folha-tipo.dto';
import { UpdateFolhaTipoDto } from './dto/update-folha-tipo.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';

@ApiTags('Folha — Tipos')
@Controller('folha/tipos')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class FolhaTiposController {
  constructor(private readonly service: FolhaTiposService) {}

  @Post()
  @Permissions(Permission.FOLHA_TIPO_CREATE)
  create(@Body() dto: CreateFolhaTipoDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions(
    Permission.FOLHA_TIPO_READ,
    Permission.FOLHA_LANCAMENTO_READ,
    Permission.FOLHA_FECHAMENTO_READ,
    Permission.FOLHA_FECHAMENTO_REGISTRAR_ABERTURA,
    Permission.FOLHA_FECHAMENTO_FECHAR,
    Permission.FOLHA_FECHAMENTO_REABRIR,
  )
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permissions(
    Permission.FOLHA_TIPO_READ,
    Permission.FOLHA_LANCAMENTO_READ,
    Permission.FOLHA_FECHAMENTO_READ,
    Permission.FOLHA_FECHAMENTO_REGISTRAR_ABERTURA,
    Permission.FOLHA_FECHAMENTO_FECHAR,
    Permission.FOLHA_FECHAMENTO_REABRIR,
  )
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.FOLHA_TIPO_UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFolhaTipoDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.FOLHA_TIPO_DELETE)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
