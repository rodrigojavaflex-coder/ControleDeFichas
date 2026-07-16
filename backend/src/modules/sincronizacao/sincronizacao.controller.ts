import { Controller, Post, Get, UseGuards, Req, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import {
  SincronizacaoService,
  SincronizacaoResult,
  SincronizacaoProgress,
} from './sincronizacao.service';
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

@ApiTags('sincronizacao')
@Controller('sincronizacao')
export class SincronizacaoController {
  constructor(private readonly sincronizacaoService: SincronizacaoService) {}

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
  @ApiOperation({ summary: 'Sincronizar somente orçamentos (escopo por unidade do usuário)' })
  @ApiResponse({ status: 200, description: 'Atualização de orçamentos executada' })
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
    summary: 'Importar etapas de produção por período (não altera watermark automático)',
  })
  @ApiResponse({ status: 200, description: 'Importação manual executada' })
  async importarProducaoEtapas(
    @Body() dto: ImportarProducaoEtapasDto,
  ): Promise<ImportarProducaoEtapasResponseDto> {
    return this.sincronizacaoService.importarProducaoEtapasManual(dto);
  }

  @Post('orcamentos/importar')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @Permissions(Permission.CONFIGURACAO_ACCESS)
  @ApiOperation({
    summary: 'Importar orçamentos por período (não altera watermark automático)',
  })
  @ApiResponse({ status: 200, description: 'Importação manual executada' })
  async importarOrcamentos(
    @Body() dto: ImportarOrcamentosDto,
  ): Promise<ImportarOrcamentosResponseDto> {
    return this.sincronizacaoService.importarOrcamentosManual(dto);
  }
}
