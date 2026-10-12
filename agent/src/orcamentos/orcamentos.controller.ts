import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { OrcamentosService } from './orcamentos.service';
import { OrcamentoExclusaoRow, OrcamentoRow } from '../database/database.types';
import { OrcamentosPeriodoDto } from './dto/orcamentos-periodo.dto';
import { OrcamentosExclusoesDto } from './dto/orcamentos-exclusoes.dto';

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

  @Post('periodo')
  async buscarOrcamentosPorPeriodo(
    @Body() body: OrcamentosPeriodoDto,
  ): Promise<{ orcamentos: OrcamentoRow[] }> {
    const orcamentos = await this.orcamentosService.buscarOrcamentosPorPeriodo(
      body.unit,
      body.start,
      body.end,
    );
    return { orcamentos };
  }

  @Post('exclusoes')
  async exclusoes(
    @Body() body: OrcamentosExclusoesDto,
  ): Promise<{ exclusoes: OrcamentoExclusaoRow[] }> {
    const exclusoes = await this.orcamentosService.buscarExclusoesOrcamentos(
      body.unit,
      body.start,
      body.end,
    );
    return { exclusoes };
  }
}
