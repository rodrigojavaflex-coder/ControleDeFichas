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
import { FindOrcamentosDto } from './dto/find-orcamentos.dto';
import { BulkUpdateRejeitadosDto } from './dto/bulk-update-rejeitados.dto';
import { OrcamentosRejeitadosOpcoesFiltroDto } from './dto/orcamentos-rejeitados-opcoes-filtro.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { PaginatedResponseDto } from '../../common/dto/paginated-response.dto';
import { Orcamento } from './entities/orcamento.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';

@ApiTags('Orçamentos')
@Controller('orcamentos')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class OrcamentosController {
  constructor(private readonly service: OrcamentosService) {}

  @Get('opcoes-filtro')
  @Permissions(
    Permission.ORCAMENTO_REJEITADO_READ,
    Permission.ORCAMENTO_APROVADO_READ,
  )
  @ApiOperation({ summary: 'Opções de filtro para listagem de orçamentos' })
  @ApiResponse({ status: 200, type: OrcamentosRejeitadosOpcoesFiltroDto })
  getOpcoesFiltro(
    @Query() dto: FindOrcamentosDto,
    @Req() req: { user: Usuario },
  ): Promise<OrcamentosRejeitadosOpcoesFiltroDto> {
    return this.service.getOpcoesFiltroOrcamentos(
      {
        unidade: dto.unidade,
        dataInicial: dto.dataInicial,
        dataFinal: dto.dataFinal,
        status: dto.status,
      },
      req.user,
    );
  }

  @Get()
  @Permissions(
    Permission.ORCAMENTO_REJEITADO_READ,
    Permission.ORCAMENTO_APROVADO_READ,
  )
  @ApiOperation({ summary: 'Listar orçamentos (paginado)' })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  findOrcamentos(
    @Query() dto: FindOrcamentosDto,
    @Req() req: { user: Usuario },
  ): Promise<PaginatedResponseDto<Orcamento>> {
    return this.service.findOrcamentos(dto, req.user);
  }

  @Patch('rejeitados/em-massa')
  @Permissions(Permission.ORCAMENTO_REJEITADO_UPDATE)
  @ApiOperation({ summary: 'Registrar motivo e observação em lote (rejeitados)' })
  atualizarRejeitadosEmMassa(
    @Body() dto: BulkUpdateRejeitadosDto,
    @Req() req: { user: Usuario },
  ): Promise<{ atualizados: number }> {
    return this.service.atualizarRejeitadosEmMassa(dto, req.user);
  }
}
