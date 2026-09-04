import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { VisitacaoAcompanhamentoService } from './visitacao-acompanhamento.service';
import { FindVisitacaoAcompanhamentoDto } from './dto/find-visitacao-acompanhamento.dto';
import { FindVisitacaoAcompanhamentoDetalheDto } from './dto/find-visitacao-acompanhamento-detalhe.dto';
import { VisitacaoAcompanhamentoListResponseDto } from './dto/visitacao-acompanhamento-list-response.dto';
import { VisitacaoAcompanhamentoDetalheDto } from './dto/visitacao-acompanhamento-detalhe.dto';
import { VisitacaoPainelMedicoRepresentanteDto } from '../visitacao-painel-medico/dto/visitacao-painel-medico-representante.dto';
import { VisitacaoAcompanhamentoOpcoesFiltroDto } from './dto/visitacao-acompanhamento-opcoes-filtro.dto';
import { FecharVisitacaoDto } from './dto/fechar-visitacao.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Unidade } from '../../common/enums/unidade.enum';

class VisitacaoAcompanhamentoRepresentantesQueryDto {
  @ApiPropertyOptional({ enum: Unidade })
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;
}

@ApiTags('Visitação — Acompanhamento')
@Controller('visitacao/acompanhamento')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class VisitacaoAcompanhamentoController {
  constructor(private readonly service: VisitacaoAcompanhamentoService) {}

  @Get('representantes')
  @Permissions(Permission.VISITACAO_ACOMPANHAMENTO_READ)
  @ApiOperation({
    summary: 'Lista funcionários com vínculo ao painel (filtro de representante)',
  })
  @ApiResponse({ status: 200, type: [VisitacaoPainelMedicoRepresentanteDto] })
  listarRepresentantes(
    @Req() req: { user: Usuario },
    @Query() query: VisitacaoAcompanhamentoRepresentantesQueryDto,
  ): Promise<VisitacaoPainelMedicoRepresentanteDto[]> {
    return this.service.listarRepresentantesVinculados(
      req.user,
      query.unidade,
    );
  }

  @Get('opcoes-filtro')
  @Permissions(Permission.VISITACAO_ACOMPANHAMENTO_READ)
  @ApiOperation({
    summary: 'Opções de médicos para o filtro (padrão orçamentos)',
  })
  @ApiResponse({ status: 200, type: VisitacaoAcompanhamentoOpcoesFiltroDto })
  opcoesFiltro(
    @Req() req: { user: Usuario },
    @Query() query: FindVisitacaoAcompanhamentoDto,
  ): Promise<VisitacaoAcompanhamentoOpcoesFiltroDto> {
    return this.service.listarOpcoesFiltro(req.user, query);
  }

  @Get('detalhe')
  @Permissions(Permission.VISITACAO_ACOMPANHAMENTO_READ)
  @ApiOperation({
    summary: 'Movimentos de caixa (recebido) e orçamentos rejeitados do médico',
  })
  @ApiResponse({ status: 200, type: VisitacaoAcompanhamentoDetalheDto })
  detalhe(
    @Req() req: { user: Usuario },
    @Query() query: FindVisitacaoAcompanhamentoDetalheDto,
  ): Promise<VisitacaoAcompanhamentoDetalheDto> {
    return this.service.detalhe(req.user, query);
  }

  @Get()
  @Permissions(Permission.VISITACAO_ACOMPANHAMENTO_READ)
  @ApiOperation({
    summary:
      'Acompanhamento por médico: valor recebido no caixa e orçamentos rejeitados',
  })
  @ApiResponse({ status: 200, type: VisitacaoAcompanhamentoListResponseDto })
  findAll(
    @Req() req: { user: Usuario },
    @Query() query: FindVisitacaoAcompanhamentoDto,
  ): Promise<VisitacaoAcompanhamentoListResponseDto> {
    return this.service.findAll(req.user, query);
  }

  @Post('fechar')
  @Permissions(Permission.VISITACAO_FECHAMENTO_FECHAR)
  @ApiOperation({
    summary:
      'Fecha a competência da unidade (retrato). Exige caixa do último dia útil CONFIRMADO.',
  })
  @ApiResponse({ status: 201, type: VisitacaoAcompanhamentoListResponseDto })
  fechar(
    @Req() req: { user: Usuario },
    @Body() dto: FecharVisitacaoDto,
  ): Promise<VisitacaoAcompanhamentoListResponseDto> {
    return this.service.fechar(req.user, dto);
  }

  @Post('reabrir')
  @Permissions(Permission.VISITACAO_FECHAMENTO_REABRIR)
  @ApiOperation({ summary: 'Reabre a competência da unidade (volta ao cálculo ao vivo).' })
  @ApiResponse({ status: 201, type: VisitacaoAcompanhamentoListResponseDto })
  reabrir(
    @Req() req: { user: Usuario },
    @Body() dto: FecharVisitacaoDto,
  ): Promise<VisitacaoAcompanhamentoListResponseDto> {
    return this.service.reabrir(req.user, dto);
  }
}
