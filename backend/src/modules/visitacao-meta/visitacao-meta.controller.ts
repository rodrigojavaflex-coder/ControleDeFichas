import {
  Body,
  Controller,
  Post,
  Put,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { VisitacaoMetaService } from './visitacao-meta.service';
import {
  CopiarVisitacaoMetaDto,
  CopiarVisitacaoMetaResponseDto,
  FindVisitacaoMetaDto,
  SalvarVisitacaoMetaDto,
  VisitacaoMetaListResponseDto,
} from './dto/visitacao-meta.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';

@ApiTags('Visitação — Configuração Metas')
@Controller('visitacao/metas')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class VisitacaoMetaController {
  constructor(private readonly service: VisitacaoMetaService) {}

  @Get()
  @Permissions(Permission.VISITACAO_META_READ)
  @ApiOperation({ summary: 'Lista metas do ano (mês opcional; omitido = todos)' })
  @ApiResponse({ status: 200, type: VisitacaoMetaListResponseDto })
  listar(
    @Req() req: { user: Usuario },
    @Query() query: FindVisitacaoMetaDto,
  ): Promise<VisitacaoMetaListResponseDto> {
    return this.service.listarMetas(req.user, query);
  }

  @Put()
  @Permissions(Permission.VISITACAO_META_UPDATE)
  @ApiOperation({ summary: 'Salva a meta mensal de um representante' })
  @ApiResponse({ status: 200, type: VisitacaoMetaListResponseDto })
  salvar(
    @Req() req: { user: Usuario },
    @Body() dto: SalvarVisitacaoMetaDto,
  ): Promise<VisitacaoMetaListResponseDto> {
    return this.service.salvarMeta(req.user, dto);
  }

  @Post('copiar')
  @Permissions(Permission.VISITACAO_META_UPDATE)
  @ApiOperation({ summary: 'Copia metas do mês de origem para o destino' })
  @ApiResponse({ status: 200, type: CopiarVisitacaoMetaResponseDto })
  copiar(
    @Req() req: { user: Usuario },
    @Body() dto: CopiarVisitacaoMetaDto,
  ): Promise<CopiarVisitacaoMetaResponseDto> {
    return this.service.copiarMesAnterior(req.user, dto);
  }
}
