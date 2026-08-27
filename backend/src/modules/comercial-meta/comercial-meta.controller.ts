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
import { ComercialMetaService } from './comercial-meta.service';
import {
  CopiarComercialMetaDto,
  CopiarComercialMetaResponseDto,
  FindComercialMetaDto,
  SalvarComercialMetaDto,
  SalvarComercialMetaUnidadeDto,
  ComercialMetaListResponseDto,
} from './dto/comercial-meta.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';

@ApiTags('Comercial — Configuração Metas')
@Controller('comercial/metas')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ComercialMetaController {
  constructor(private readonly service: ComercialMetaService) {}

  @Get()
  @Permissions(Permission.COMERCIAL_META_READ)
  @ApiOperation({ summary: 'Lista metas comerciais do ano (mês opcional)' })
  @ApiResponse({ status: 200, type: ComercialMetaListResponseDto })
  listar(
    @Req() req: { user: Usuario },
    @Query() query: FindComercialMetaDto,
  ): Promise<ComercialMetaListResponseDto> {
    return this.service.listarMetas(req.user, query);
  }

  @Put('unidade')
  @Permissions(Permission.COMERCIAL_META_UPDATE)
  @ApiOperation({ summary: 'Salva as duas metas da loja na competência' })
  @ApiResponse({ status: 200, type: ComercialMetaListResponseDto })
  salvarUnidade(
    @Req() req: { user: Usuario },
    @Body() dto: SalvarComercialMetaUnidadeDto,
  ): Promise<ComercialMetaListResponseDto> {
    return this.service.salvarMetaUnidade(req.user, dto);
  }

  @Put()
  @Permissions(Permission.COMERCIAL_META_UPDATE)
  @ApiOperation({ summary: 'Salva meta mensal de um vendedor (por tipo base)' })
  @ApiResponse({ status: 200, type: ComercialMetaListResponseDto })
  salvar(
    @Req() req: { user: Usuario },
    @Body() dto: SalvarComercialMetaDto,
  ): Promise<ComercialMetaListResponseDto> {
    return this.service.salvarMeta(req.user, dto);
  }

  @Post('copiar')
  @Permissions(Permission.COMERCIAL_META_UPDATE)
  @ApiOperation({ summary: 'Copia metas do mês de origem para o destino' })
  @ApiResponse({ status: 200, type: CopiarComercialMetaResponseDto })
  copiar(
    @Req() req: { user: Usuario },
    @Body() dto: CopiarComercialMetaDto,
  ): Promise<CopiarComercialMetaResponseDto> {
    return this.service.copiarMesAnterior(req.user, dto);
  }
}
