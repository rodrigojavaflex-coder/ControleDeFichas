import { Controller, Post, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SincronizacaoService, SincronizacaoResult, SincronizacaoProgress } from './sincronizacao.service';

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
  async status() {
    return { message: 'Sincronização disponível' };
  }
}
