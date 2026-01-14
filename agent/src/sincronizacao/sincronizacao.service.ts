import { Injectable, BadRequestException, Logger } from '@nestjs/common';
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

export interface PrescritorRow {
  nrcrm?: number;
  ufcrm?: string;
  nomemed: string;
  dtcad: string;
}

export interface SincronizacaoResponse {
  clientes: ClienteRow[];
  prescritores: PrescritorRow[];
}

@Injectable()
export class SincronizacaoService {
  private readonly logger = new Logger(SincronizacaoService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async buscarDadosSincronizacao(
    dataMinimaCliente: string,
    dataMinimaPrescritor: string,
    unit: number,
  ): Promise<SincronizacaoResponse> {
    this.logger.log(`Recebida requisição de sincronização com parâmetros:`);
    this.logger.log(`  - dataMinimaCliente: ${dataMinimaCliente}`);
    this.logger.log(`  - dataMinimaPrescritor: ${dataMinimaPrescritor}`);
    this.logger.log(`  - unit (cdfil): ${unit}`);

    // Validar parâmetros
    if (!dataMinimaCliente || !/^\d{4}-\d{2}-\d{2}$/.test(dataMinimaCliente)) {
      throw new BadRequestException(
        'dataMinimaCliente deve estar no formato YYYY-MM-DD',
      );
    }

    if (!dataMinimaPrescritor || !/^\d{4}-\d{2}-\d{2}$/.test(dataMinimaPrescritor)) {
      throw new BadRequestException(
        'dataMinimaPrescritor deve estar no formato YYYY-MM-DD',
      );
    }

    if (!unit || unit <= 0) {
      throw new BadRequestException('unit deve ser um número válido maior que zero');
    }

    // Buscar ambos os dados em uma única conexão (otimizado)
    this.logger.log(`Buscando clientes e prescritores no banco Firebird...`);
    const { clientes, prescritores } =
      await this.databaseService.buscarClientesEPrescritores(
        dataMinimaCliente,
        dataMinimaPrescritor,
        unit,
      );

    this.logger.log(`Resultado da busca: ${clientes?.length || 0} clientes, ${prescritores?.length || 0} prescritores`);

    return {
      clientes,
      prescritores,
    };
  }
}
