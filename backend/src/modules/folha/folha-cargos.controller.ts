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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FolhaCargosService } from './folha-cargos.service';
import { CreateFolhaCargoDto } from './dto/create-folha-cargo.dto';
import { UpdateFolhaCargoDto } from './dto/update-folha-cargo.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';

@ApiTags('Folha — Cargos')
@Controller('folha/cargos')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class FolhaCargosController {
  constructor(private readonly service: FolhaCargosService) {}

  @Post()
  @Permissions(Permission.FOLHA_CARGO_CREATE)
  create(@Body() dto: CreateFolhaCargoDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions(
    Permission.FOLHA_CARGO_READ,
    Permission.FOLHA_FUNCIONARIO_READ,
    Permission.FOLHA_FUNCIONARIO_CREATE,
    Permission.FOLHA_FUNCIONARIO_UPDATE,
  )
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permissions(
    Permission.FOLHA_CARGO_READ,
    Permission.FOLHA_FUNCIONARIO_READ,
    Permission.FOLHA_FUNCIONARIO_CREATE,
    Permission.FOLHA_FUNCIONARIO_UPDATE,
  )
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.FOLHA_CARGO_UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFolhaCargoDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.FOLHA_CARGO_DELETE)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
