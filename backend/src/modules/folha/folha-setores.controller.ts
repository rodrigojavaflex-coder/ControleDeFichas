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
import { FolhaSetoresService } from './folha-setores.service';
import { CreateFolhaSetorDto } from './dto/create-folha-setor.dto';
import { UpdateFolhaSetorDto } from './dto/update-folha-setor.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';

@ApiTags('Folha — Setores')
@Controller('folha/setores')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class FolhaSetoresController {
  constructor(private readonly service: FolhaSetoresService) {}

  @Post()
  @Permissions(Permission.FOLHA_SETOR_CREATE)
  create(@Body() dto: CreateFolhaSetorDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions(
    Permission.FOLHA_SETOR_READ,
    Permission.FOLHA_FUNCIONARIO_READ,
    Permission.FOLHA_FUNCIONARIO_CREATE,
    Permission.FOLHA_FUNCIONARIO_UPDATE,
  )
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permissions(
    Permission.FOLHA_SETOR_READ,
    Permission.FOLHA_FUNCIONARIO_READ,
    Permission.FOLHA_FUNCIONARIO_CREATE,
    Permission.FOLHA_FUNCIONARIO_UPDATE,
  )
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.FOLHA_SETOR_UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFolhaSetorDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.FOLHA_SETOR_DELETE)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
