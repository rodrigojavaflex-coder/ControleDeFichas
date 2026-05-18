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
import { FolhaVerbasService } from './folha-verbas.service';
import { CreateFolhaVerbaDto } from './dto/create-folha-verba.dto';
import { UpdateFolhaVerbaDto } from './dto/update-folha-verba.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';

@ApiTags('Folha — Verbas')
@Controller('folha/verbas')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class FolhaVerbasController {
  constructor(private readonly service: FolhaVerbasService) {}

  @Post()
  @Permissions(Permission.FOLHA_VERBA_CREATE)
  @ApiOperation({ summary: 'Criar verba' })
  create(@Body() dto: CreateFolhaVerbaDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions(Permission.FOLHA_VERBA_READ, Permission.FOLHA_LANCAMENTO_READ)
  @ApiOperation({ summary: 'Listar verbas' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Permissions(Permission.FOLHA_VERBA_READ, Permission.FOLHA_LANCAMENTO_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions(Permission.FOLHA_VERBA_UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFolhaVerbaDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.FOLHA_VERBA_DELETE)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
