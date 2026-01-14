import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface ClienteRow {
  cdcli: number;
  nomecli: string;
  nrcnpj?: string;
  email?: string;
  dtnas?: string;
  cdfil: number;
  dtcad: string;
}

@Injectable()
export class ClientesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async buscarClientes(
    dataMinima: string,
    unit: number,
  ): Promise<ClienteRow[]> {
    if (!dataMinima || !/^\d{4}-\d{2}-\d{2}$/.test(dataMinima)) {
      throw new BadRequestException(
        'dataMinima deve estar no formato YYYY-MM-DD',
      );
    }

    if (!unit || unit <= 0) {
      throw new BadRequestException('unit deve ser um número válido maior que zero');
    }

    return this.databaseService.buscarClientes(dataMinima, unit);
  }
}
