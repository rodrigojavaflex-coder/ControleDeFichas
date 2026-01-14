import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface PrescritorRow {
  nrcrm?: number;
  ufcrm?: string;
  nomemed: string;
  dtcad: string;
}

@Injectable()
export class PrescritoresService {
  constructor(private readonly databaseService: DatabaseService) {}

  async buscarPrescritores(dataMinima: string): Promise<PrescritorRow[]> {
    if (!dataMinima || !/^\d{4}-\d{2}-\d{2}$/.test(dataMinima)) {
      throw new BadRequestException(
        'dataMinima deve estar no formato YYYY-MM-DD',
      );
    }

    return this.databaseService.buscarPrescritores(dataMinima);
  }
}
