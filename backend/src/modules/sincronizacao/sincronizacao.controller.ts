import {
  Controller,
  Post,
  Get,
  UseGuards,
  Req,
  Body,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  SincronizacaoService,
  SincronizacaoResult,
  SincronizacaoProgress,
} from './sincronizacao.service';
import { ProducaoEtapasLimpezaService } from './producao-etapas-limpeza.service';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permission } from '../../common/enums/permission.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  ImportarProducaoEtapasDto,
  ImportarProducaoEtapasResponseDto,
} from './dto/importar-producao-etapas.dto';
import {
  ImportarOrcamentosDto,
  ImportarOrcamentosResponseDto,
} from './dto/importar-orcamentos.dto';
import {
  LimparProducaoEtapasAntigasDto,
  LimparProducaoEtapasAntigasResponseDto,
  ListarFormulasSemFimLimpezaResponseDto,
  ProducaoEtapaDisponivelDto,
} from './dto/limpar-producao-etapas-antigas.dto';
import { ProducaoConfigUnidadeQueryDto } from '../producao-config/dto/producao-config-unidade-query.dto';

@ApiTags('sincronizacao')
@Controller('sincronizacao')
export class SincronizacaoController {
  constructor(
    private readonly sincronizacaoService: SincronizacaoService,
    private readonly producaoEtapasLimpezaService: ProducaoEtapasLimpezaService,
  ) {}

  @Post('executar')
  @ApiOperation({ summary: 'Executar sincronização manualmente' })
  @ApiResponse({
    status: 200,
    description: 'Sincronização executada com sucesso',
    type: [Object] as any,
  })
  async executar(): Promise<SincronizacaoResult[]> {
    return this.sincronizacaoService.executarSincronizacao();
  }

  @Post('orcamentos')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.ORCAMENTO_REJEITADO_SYNC)
  @ApiOperation({
    summary: 'Sincronizar somente orçamentos (escopo por unidade do usuário)',
  })
  @ApiResponse({
    status: 200,
    description: 'Atualização de orçamentos executada',
  })
  @ApiResponse({ status: 409, description: 'Sincronização já em andamento' })
  async executarOrcamentos(
    @Req() req: { user: Usuario },
  ): Promise<SincronizacaoResult[]> {
    return this.sincronizacaoService.executarSincronizacaoOrcamentos(req.user);
  }

  @Get('progresso')
  @ApiOperation({ summary: 'Obter progresso da sincronização em andamento' })
  @ApiResponse({
    status: 200,
    description: 'Progresso da sincronização',
  })
  getProgresso(): SincronizacaoProgress | null {
    return this.sincronizacaoService.getProgress();
  }

  @Get('status')
  @ApiOperation({ summary: 'Verificar status da sincronização' })
  @ApiResponse({
    status: 200,
    description: 'Status da sincronização',
  })
  status(): {
    emExecucao: boolean;
    progresso: SincronizacaoProgress | null;
  } {
    return {
      emExecucao: this.sincronizacaoService.estaEmExecucao(),
      progresso: this.sincronizacaoService.getProgress(),
    };
  }

  @Post('producao-etapas/importar')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.CONFIGURACAO_ACCESS)
  @ApiOperation({
    summary:
      'Importar etapas de produção por período (não altera watermark automático)',
  })
  @ApiResponse({ status: 200, description: 'Importação manual executada' })
  async importarProducaoEtapas(
    @Body() dto: ImportarProducaoEtapasDto,
  ): Promise<ImportarProducaoEtapasResponseDto> {
    return this.sincronizacaoService.importarProducaoEtapasManual(dto);
  }

  @Get('producao-etapas/etapas-disponiveis')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.CONFIGURACAO_ACCESS)
  @ApiOperation({
    summary:
      'Lista etapas distintas da unidade (para seleção na limpeza de etapas antigas)',
  })
  @ApiResponse({ status: 200, type: [ProducaoEtapaDisponivelDto] })
  listarEtapasDisponiveisLimpeza(
    @Query() query: ProducaoConfigUnidadeQueryDto,
  ): Promise<ProducaoEtapaDisponivelDto[]> {
    return this.producaoEtapasLimpezaService.listarEtapasDisponiveis(
      query.unidade,
    );
  }

  @Post('producao-etapas/limpar-antigas/preview')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.CONFIGURACAO_ACCESS)
  @ApiOperation({
    summary:
      'Pré-visualiza limpeza de etapas antigas (não altera dados; RN-PCP-011)',
  })
  @ApiResponse({ status: 200, type: LimparProducaoEtapasAntigasResponseDto })
  previewLimparProducaoEtapasAntigas(
    @Body() dto: LimparProducaoEtapasAntigasDto,
  ): Promise<LimparProducaoEtapasAntigasResponseDto> {
    return this.producaoEtapasLimpezaService.preview(dto);
  }

  @Post('producao-etapas/limpar-antigas/formulas-sem-fim')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.CONFIGURACAO_ACCESS)
  @ApiOperation({
    summary:
      'Lista completa de req-fórmulas sem fim nas etapas finais (prévia da limpeza)',
  })
  @ApiResponse({ status: 200, type: ListarFormulasSemFimLimpezaResponseDto })
  listarFormulasSemFimLimpeza(
    @Body() dto: LimparProducaoEtapasAntigasDto,
  ): Promise<ListarFormulasSemFimLimpezaResponseDto> {
    return this.producaoEtapasLimpezaService.listarFormulasSemFim(dto);
  }

  @Post('producao-etapas/limpar-antigas')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.CONFIGURACAO_ACCESS)
  @ApiOperation({
    summary:
      'Executa limpeza de etapas antigas por unidade/data/etapas finais (RN-PCP-011)',
  })
  @ApiResponse({ status: 200, type: LimparProducaoEtapasAntigasResponseDto })
  limparProducaoEtapasAntigas(
    @Body() dto: LimparProducaoEtapasAntigasDto,
  ): Promise<LimparProducaoEtapasAntigasResponseDto> {
    return this.producaoEtapasLimpezaService.executar(dto);
  }

  @Post('orcamentos/importar')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.CONFIGURACAO_ACCESS)
  @ApiOperation({
    summary:
      'Importar orçamentos por período (não altera watermark automático)',
  })
  @ApiResponse({ status: 200, description: 'Importação manual executada' })
  async importarOrcamentos(
    @Body() dto: ImportarOrcamentosDto,
  ): Promise<ImportarOrcamentosResponseDto> {
    return this.sincronizacaoService.importarOrcamentosManual(dto);
  }
}
