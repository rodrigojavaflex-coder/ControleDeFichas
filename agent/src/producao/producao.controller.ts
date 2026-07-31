import { Body, Controller, Post } from '@nestjs/common';
import { ProducaoService } from './producao.service';
import { ProducaoEtapasResumoDto } from './dto/producao-etapas-resumo.dto';

import { ProducaoExclusoesReceitasDto } from './dto/producao-exclusoes-receitas.dto';

@Controller('v1/producao')
export class ProducaoController {
  constructor(private readonly producaoService: ProducaoService) {}

  @Post('etapas-resumo')
  async etapasResumo(@Body() body: ProducaoEtapasResumoDto) {
    return this.producaoService.buscarEtapasResumo(body);
  }

  @Post('exclusoes-receitas')
  async exclusoesReceitas(@Body() body: ProducaoExclusoesReceitasDto) {
    return this.producaoService.buscarExclusoesReceitas(body);
  }
}
