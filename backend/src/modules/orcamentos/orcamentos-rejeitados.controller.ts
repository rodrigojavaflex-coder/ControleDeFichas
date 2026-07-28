import {
  Controller,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrcamentosService } from './orcamentos.service';
import { FindOrcamentosRejeitadosDto } from './dto/find-orcamentos-rejeitados.dto';
import { BulkUpdateRejeitadosDto } from './dto/bulk-update-rejeitados.dto';
import { OrcamentosRejeitadosOpcoesFiltroDto } from './dto/orcamentos-rejeitados-opcoes-filtro.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { Orcamento } from './entities/orcamento.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';

/** Rotas legadas — preferir `GET /orcamentos`. */
@ApiTags('Orçamentos — Rejeitados (legado)')
@Controller('orcamentos/rejeitados')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class OrcamentosRejeitadosController {
  constructor(private readonly service: OrcamentosService) {}

  @Get('opcoes-filtro')
  @Permissions(Permission.ORCAMENTO_REJEITADO_READ)
  @ApiOperation({
    summary: '[Legado] Opções de filtro para orçamentos rejeitados',
  })
  @ApiResponse({ status: 200, type: OrcamentosRejeitadosOpcoesFiltroDto })
  getOpcoesFiltro(
    @Query() dto: FindOrcamentosRejeitadosDto,
    @Req() req: { user: Usuario },
  ): Promise<OrcamentosRejeitadosOpcoesFiltroDto> {
    return this.service.getOpcoesFiltroOrcamentos(
      {
        unidade: dto.unidade,
        dataInicial: dto.dataInicial,
        dataFinal: dto.dataFinal,
        status: 'REJEITADO',
      },
      req.user,
    );
  }

  @Get()
  @Permissions(Permission.ORCAMENTO_REJEITADO_READ)
  @ApiOperation({ summary: '[Legado] Listar orçamentos rejeitados (paginado)' })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  findRejeitados(
    @Query() dto: FindOrcamentosRejeitadosDto,
    @Req() req: { user: Usuario },
  ): Promise<PaginatedResponseDto<Orcamento>> {
    return this.service.findOrcamentos(
      { ...dto, status: 'REJEITADO' },
      req.user,
    );
  }

  @Patch('em-massa')
  @Permissions(Permission.ORCAMENTO_REJEITADO_UPDATE)
  @ApiOperation({ summary: '[Legado] Registrar motivo e observação em lote' })
  atualizarEmMassa(
    @Body() dto: BulkUpdateRejeitadosDto,
    @Req() req: { user: Usuario },
  ): Promise<{ atualizados: number }> {
    return this.service.atualizarRejeitadosEmMassa(dto, req.user);
  }
}
