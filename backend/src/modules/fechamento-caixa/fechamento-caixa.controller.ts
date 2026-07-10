import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Query,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Permission } from '../../common/enums/permission.enum';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { ImportarCaixaErpDto } from './dto/importar-caixa-erp.dto';
import { ImportarCaixaErpResponseDto } from './dto/importar-caixa-erp-response.dto';
import { FechamentoCaixaService } from './fechamento-caixa.service';
import { CaixaFechamentoConsolidadoService } from './caixa-fechamento-consolidado.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { FechamentoConsolidadoQueryDto } from './dto/fechamento-consolidado-query.dto';
import { FechamentoConsolidadoResponseDto } from './dto/fechamento-consolidado-response.dto';
import { FechamentoCaixaDetalhadoResponseDto } from './dto/fechamento-caixa-detalhado-response.dto';
import { SalvarFechamentoRascunhoDto } from './dto/salvar-fechamento-rascunho.dto';
import {
  AtualizarSaldoInicialUnidadeDto,
  CaixaSaldoInicialUnidadeDto,
} from './dto/caixa-saldo-inicial.dto';

@ApiTags('Fechamento Caixa ERP')
@Controller('fechamento')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
export class FechamentoCaixaController {
  constructor(
    private readonly fechamentoCaixaService: FechamentoCaixaService,
    private readonly consolidadoService: CaixaFechamentoConsolidadoService,
  ) {}

  @Post('importar-caixa-erp')
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.VENDA_FECHAR_CAIXA)
  @ApiOperation({
    summary: 'Importar caixa ERP do Firebird via agente (upsert por chave_erp)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Importação concluída',
    type: ImportarCaixaErpResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Parâmetros inválidos ou agente não configurado',
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'Agente indisponível ou erro na consulta Firebird',
  })
  importarCaixaErp(
    @Req() req: { user: Usuario },
    @Body() dto: ImportarCaixaErpDto,
  ): Promise<ImportarCaixaErpResponseDto> {
    return this.fechamentoCaixaService.importarCaixaErp(req.user, dto);
  }

  @Get('saldos-iniciais')
  @ApiOperation({ summary: 'Listar saldo inicial de caixa por unidade' })
  @ApiResponse({ status: HttpStatus.OK, type: [CaixaSaldoInicialUnidadeDto] })
  listarSaldosIniciais(): Promise<CaixaSaldoInicialUnidadeDto[]> {
    return this.consolidadoService.listarSaldosIniciais();
  }

  @Put('saldos-iniciais')
  @ApiOperation({ summary: 'Atualizar saldo inicial de caixa de uma unidade' })
  @ApiResponse({ status: HttpStatus.OK, type: CaixaSaldoInicialUnidadeDto })
  atualizarSaldoInicial(
    @Body() dto: AtualizarSaldoInicialUnidadeDto,
  ): Promise<CaixaSaldoInicialUnidadeDto> {
    return this.consolidadoService.atualizarSaldoInicial(dto);
  }

  @Get('consolidado')
  @ApiOperation({ summary: 'Obter rascunho consolidado ERP + terceiro' })
  @ApiResponse({ status: HttpStatus.OK, type: FechamentoConsolidadoResponseDto })
  obterConsolidado(
    @Query() query: FechamentoConsolidadoQueryDto,
  ): Promise<FechamentoConsolidadoResponseDto> {
    return this.consolidadoService.obterConsolidado(query);
  }

  @Get('consolidado/detalhado')
  @ApiOperation({
    summary: 'Obter detalhes de baixas e pagamentos ERP para relatório',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    type: FechamentoCaixaDetalhadoResponseDto,
  })
  async obterCaixaDetalhado(
    @Query() query: FechamentoConsolidadoQueryDto,
  ): Promise<FechamentoCaixaDetalhadoResponseDto> {
    await this.consolidadoService.assertPodeEmitirRelatorio(
      query.unidade,
      query.data,
    );
    return this.fechamentoCaixaService.obterCaixaDetalhado(
      query.unidade,
      query.data,
    );
  }

  @Put('consolidado/rascunho')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.VENDA_FECHAR_CAIXA)
  @ApiOperation({ summary: 'Salvar despesas e retirada do fechamento' })
  salvarRascunho(
    @Body() dto: SalvarFechamentoRascunhoDto,
  ): Promise<FechamentoConsolidadoResponseDto> {
    return this.consolidadoService.salvarRascunho(dto);
  }

  @Post('consolidado/confirmar')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.VENDA_FECHAR_CAIXA)
  @ApiOperation({ summary: 'Confirmar fechamento consolidado de caixa' })
  confirmarFechamento(
    @Req() req: { user: Usuario },
    @Body() query: FechamentoConsolidadoQueryDto,
  ): Promise<FechamentoConsolidadoResponseDto> {
    return this.consolidadoService.confirmarFechamento(
      req.user,
      query.unidade,
      query.data,
    );
  }

  @Post('consolidado/reabrir')
  @UseGuards(PermissionsGuard)
  @Permissions(Permission.VENDA_REABRIR_CAIXA)
  @ApiOperation({ summary: 'Reabrir último fechamento consolidado' })
  reabrirFechamento(
    @Body() query: FechamentoConsolidadoQueryDto,
  ): Promise<FechamentoConsolidadoResponseDto> {
    return this.consolidadoService.reabrirFechamento(query.unidade, query.data);
  }
}
