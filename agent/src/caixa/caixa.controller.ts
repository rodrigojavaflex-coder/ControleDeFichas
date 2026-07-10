import { Body, Controller, Post } from '@nestjs/common';
import {
  CaixaFechamentoDiaResponse,
  CaixaItensResponse,
  CaixaPagamentosResponse,
  CaixaRequisicoesPagasResponse,
  CaixaService,
} from './caixa.service';
import { CaixaPeriodoDto } from './dto/caixa-periodo.dto';

@Controller('v1/caixa')
export class CaixaController {
  constructor(private readonly caixaService: CaixaService) {}

  @Post('pagamentos')
  async pagamentos(
    @Body() body: CaixaPeriodoDto,
  ): Promise<CaixaPagamentosResponse> {
    return this.caixaService.buscarPagamentos(body);
  }

  @Post('itens')
  async itens(@Body() body: CaixaPeriodoDto): Promise<CaixaItensResponse> {
    return this.caixaService.buscarItens(body);
  }

  @Post('requisicoes-pagas')
  async requisicoesPagas(
    @Body() body: CaixaPeriodoDto,
  ): Promise<CaixaRequisicoesPagasResponse> {
    return this.caixaService.buscarRequisicoesPagas(body);
  }

  @Post('fechamento-dia')
  async fechamentoDia(
    @Body() body: CaixaPeriodoDto,
  ): Promise<CaixaFechamentoDiaResponse> {
    return this.caixaService.buscarFechamentoDia(body);
  }
}
