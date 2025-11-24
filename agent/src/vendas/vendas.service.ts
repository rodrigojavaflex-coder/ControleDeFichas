import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { VendasTotalRow } from '../database/database.types';
import { TotalDiaDto } from './dto/total-dia.dto';

interface TotalDiaResponse {
  date: string;
  unit: number;
  items: VendasTotalRow[];
}

@Injectable()
export class VendasService {
  constructor(private readonly databaseService: DatabaseService) {}

  async totalDeVendasDoDia(dto: TotalDiaDto): Promise<TotalDiaResponse> {
    const queryDate = this.parseDate(dto.date);
    const unit = this.normalizeUnit(dto.unit);

    const items = await this.databaseService.totalVendasDoDia(queryDate, unit);

    return {
      date: this.formatDate(queryDate),
      unit,
      items,
    };
  }

  private parseDate(date: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Data deve estar no formato YYYY-MM-DD');
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);

    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Data inválida');
    }

    return parsed;
  }

  private normalizeUnit(unit: number): number {
    if (!Number.isInteger(unit)) {
      throw new BadRequestException('Código de unidade inválido');
    }

    return unit;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}
