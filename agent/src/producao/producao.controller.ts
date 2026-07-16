import { Body, Controller, Post } from '@nestjs/common';
import { ProducaoService } from './producao.service';
import { ProducaoEtapasResumoDto } from './dto/producao-etapas-resumo.dto';

@Controller('v1/producao')
export class ProducaoController {
  constructor(private readonly producaoService: ProducaoService) {}

  @Post('etapas-resumo')
  async etapasResumo(@Body() body: ProducaoEtapasResumoDto) {
    return this.producaoService.buscarEtapasResumo(body);
  }
}
