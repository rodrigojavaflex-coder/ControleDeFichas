import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FolhaFuncionariosService } from './folha-funcionarios.service';
import { CreateFuncionarioFolhaDto } from './dto/create-funcionario-folha.dto';
import { FindFuncionarioFolhaDto } from './dto/find-funcionario-folha.dto';
import { UpdateFuncionarioFolhaDto } from './dto/update-funcionario-folha.dto';
import { FindFuncionariosLancamentoFolhaDto } from './dto/find-funcionarios-lancamento-folha.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';

@ApiTags('Folha — Funcionários')
@Controller('folha/funcionarios')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class FolhaFuncionariosController {
  constructor(private readonly service: FolhaFuncionariosService) {}

  @Post()
  @Permissions(Permission.FOLHA_FUNCIONARIO_CREATE)
  @ApiOperation({ summary: 'Cadastrar funcionário (com unidade no cadastro)' })
  create(
    @Body() dto: CreateFuncionarioFolhaDto,
    @Req() req: { user: Usuario },
  ) {
    return this.service.create(req.user, dto);
  }

  @Get()
  @Permissions(Permission.FOLHA_FUNCIONARIO_READ)
  @ApiOperation({
    summary: 'Listar funcionários da unidade (paginado, filtro opcional por nome)',
  })
  findAll(@Query() q: FindFuncionarioFolhaDto, @Req() req: { user: Usuario }) {
    return this.service.findPaginated(req.user, q);
  }

  /** Rota antes de `:id`. */
  @Get('lancamento')
  @Permissions(
    Permission.FOLHA_FUNCIONARIO_READ,
    Permission.FOLHA_LANCAMENTO_READ,
  )
  @ApiOperation({
    summary: 'Listar funcionários da unidade para lançamentos de folha',
  })
  listarParaLancamento(
    @Query() q: FindFuncionariosLancamentoFolhaDto,
    @Req() req: { user: Usuario },
  ) {
    return this.service.listarParaLancamento(req.user, q);
  }

  @Get(':id')
  @Permissions(Permission.FOLHA_FUNCIONARIO_READ)
  @ApiOperation({ summary: 'Detalhe do funcionário' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: Usuario }) {
    return this.service.findOne(req.user, id);
  }

  @Patch(':id')
  @Permissions(Permission.FOLHA_FUNCIONARIO_UPDATE)
  @ApiOperation({ summary: 'Atualizar dados do funcionário (inclusive unidade, se permitido pelo escopo)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFuncionarioFolhaDto,
    @Req() req: { user: Usuario },
  ) {
    return this.service.update(req.user, id, dto);
  }

  @Delete(':id')
  @Permissions(Permission.FOLHA_FUNCIONARIO_DELETE)
  @ApiOperation({
    summary:
      'Excluir funcionário (bloqueado se existir folha_capa / histórico de lançamentos)',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user: Usuario },
  ) {
    return this.service.remove(req.user, id);
  }
}
