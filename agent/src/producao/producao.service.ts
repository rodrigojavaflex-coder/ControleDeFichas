import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ProducaoEtapaResumoRow } from '../database/database.types';
import { ProducaoEtapasResumoDto } from './dto/producao-etapas-resumo.dto';

@Injectable()
export class ProducaoService {
  constructor(private readonly databaseService: DatabaseService) {}

  async buscarEtapasResumo(
    dto: ProducaoEtapasResumoDto,
  ): Promise<{ etapas: ProducaoEtapaResumoRow[] }> {
    const hasPeriodo = !!dto.start && !!dto.end;
    const hasIncremental = !!dto.dataMinimaMovimento;

    if (hasPeriodo === hasIncremental) {
      throw new BadRequestException(
        'Informe start/end (período) ou dataMinimaMovimento (incremental), não ambos',
      );
    }

    if (hasPeriodo) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.start!) || !/^\d{4}-\d{2}-\d{2}$/.test(dto.end!)) {
        throw new BadRequestException('start e end devem estar no formato YYYY-MM-DD');
      }
    }

    const rows = await this.databaseService.buscarProducaoEtapasResumo(
      dto.unit,
      hasPeriodo
        ? { start: dto.start, end: dto.end }
        : { dataMinimaMovimento: dto.dataMinimaMovimento },
    );

    return { etapas: rows };
  }
}
