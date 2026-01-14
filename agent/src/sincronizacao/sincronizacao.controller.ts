import { Controller, Get, Query } from '@nestjs/common';
import { SincronizacaoService } from './sincronizacao.service';

@Controller('v1/sincronizacao')
export class SincronizacaoController {
  constructor(private readonly sincronizacaoService: SincronizacaoService) {}

  @Get()
  async buscarDadosSincronizacao(
    @Query('dataMinimaCliente') dataMinimaCliente: string,
    @Query('dataMinimaPrescritor') dataMinimaPrescritor: string,
    @Query('unit') unit: string,
  ) {
    const unitNum = unit ? parseInt(unit, 10) : 0;

    if (isNaN(unitNum) || unitNum <= 0) {
      throw new Error('unit deve ser um número válido maior que zero');
    }

    return this.sincronizacaoService.buscarDadosSincronizacao(
      dataMinimaCliente,
      dataMinimaPrescritor,
      unitNum,
    );
  }
}
