import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ValorCompraDto } from './dto/valor-compra.dto';

export interface ValorCompraItem {
  protocolo: number;
  valor_compra: number;
}

export interface ValorCompraResponse {
  unit: number;
  resultados: ValorCompraItem[];
}

@Injectable()
export class VendasService {
  constructor(private readonly databaseService: DatabaseService) {}

  async buscarValorCompra(dto: ValorCompraDto): Promise<ValorCompraResponse> {
    const { unit, protocolos } = dto;

    if (!protocolos?.length) {
      throw new BadRequestException('Lista de protocolos não pode ser vazia.');
    }

    if (protocolos.length > 1000) {
      throw new BadRequestException('Limite máximo de 1000 protocolos por chamada.');
    }

    if (!Number.isInteger(unit)) {
      throw new BadRequestException('Código de unidade inválido');
    }

    const resultados = await this.databaseService.valorCompraPorProtocolos(
      unit,
      protocolos,
    );

    return {
      unit,
      resultados,
    };
  }
}
