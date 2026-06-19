import { Controller, Get, Query } from '@nestjs/common';
import { OrcamentosService } from './orcamentos.service';
import { OrcamentoRow } from '../database/database.types';

@Controller('v1/orcamentos')
export class OrcamentosController {
  constructor(private readonly orcamentosService: OrcamentosService) {}

  @Get()
  async buscarOrcamentos(
    @Query('dataMinimaModificacao') dataMinimaModificacao: string,
    @Query('unit') unit: string,
  ): Promise<{ orcamentos: OrcamentoRow[] }> {
    const unitNum = unit ? parseInt(unit, 10) : 0;

    if (isNaN(unitNum) || unitNum <= 0) {
      throw new Error('unit deve ser um número válido maior que zero');
    }

    const orcamentos = await this.orcamentosService.buscarOrcamentos(
      dataMinimaModificacao,
      unitNum,
    );

    return { orcamentos };
  }
}
