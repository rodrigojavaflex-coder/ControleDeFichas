import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { PainelMedicoRepresentanteRow } from '../database/database.types';

@Injectable()
export class PainelService {
  constructor(private readonly databaseService: DatabaseService) {}

  async buscarMedicosRepresentantes(
    cdcon: number,
    cdfunRaw: string,
  ): Promise<{ medicos_representantes: PainelMedicoRepresentanteRow[] }> {
    const cdfun = this.parseCdfunList(cdfunRaw);
    const rows = await this.databaseService.buscarMedicosRepresentantes(
      cdcon,
      cdfun,
    );
    return { medicos_representantes: rows };
  }

  private parseCdfunList(value: string): number[] {
    const items = value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => !isNaN(item) && item > 0);

    if (!items.length) {
      throw new BadRequestException(
        'cdfun deve conter ao menos um código de representante válido',
      );
    }

    return items;
  }
}
