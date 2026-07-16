import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { OrcamentoRow } from '../database/database.types';

@Injectable()
export class OrcamentosService {
  constructor(private readonly databaseService: DatabaseService) {}

  async buscarOrcamentos(
    dataMinimaModificacao: string,
    unit: number,
  ): Promise<OrcamentoRow[]> {
    if (
      !dataMinimaModificacao ||
      !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(dataMinimaModificacao)
    ) {
      throw new BadRequestException(
        'dataMinimaModificacao deve estar no formato YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss',
      );
    }

    if (!unit || unit <= 0) {
      throw new BadRequestException(
        'unit deve ser um número válido maior que zero',
      );
    }

    return this.databaseService.buscarOrcamentos(dataMinimaModificacao, unit);
  }

  async buscarOrcamentosPorPeriodo(
    unit: number,
    start: string,
    end: string,
  ): Promise<OrcamentoRow[]> {
    if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
      throw new BadRequestException(
        'start deve estar no formato YYYY-MM-DD',
      );
    }

    if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      throw new BadRequestException('end deve estar no formato YYYY-MM-DD');
    }

    if (start > end) {
      throw new BadRequestException(
        'start não pode ser posterior a end',
      );
    }

    if (!unit || unit <= 0) {
      throw new BadRequestException(
        'unit deve ser um número válido maior que zero',
      );
    }

    return this.databaseService.buscarOrcamentosPorPeriodo(unit, start, end);
  }
}
