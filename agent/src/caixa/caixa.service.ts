import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  CaixaFechamentoDiaRow,
  CaixaItemRow,
  CaixaPagamentoRow,
  CaixaRequisicaoPagaRow,
} from '../database/database.types';
import { CaixaPeriodoDto } from './dto/caixa-periodo.dto';

export interface CaixaPeriodoResolvido {
  unit: number;
  start: string;
  end: string;
  filtrarFlagBaixa: boolean;
}

export interface CaixaPagamentosResponse {
  unit: number;
  start: string;
  end: string;
  pagamentos: CaixaPagamentoRow[];
}

export interface CaixaItensResponse {
  unit: number;
  start: string;
  end: string;
  itens: CaixaItemRow[];
}

export interface CaixaRequisicoesPagasResponse {
  unit: number;
  start: string;
  end: string;
  requisicoes: CaixaRequisicaoPagaRow[];
}

export interface CaixaFechamentoDiaResponse {
  unit: number;
  start: string;
  end: string;
  resumo: CaixaFechamentoDiaRow[];
  totalLiquido: number;
}

@Injectable()
export class CaixaService {
  constructor(private readonly databaseService: DatabaseService) {}

  async buscarPagamentos(dto: CaixaPeriodoDto): Promise<CaixaPagamentosResponse> {
    const periodo = this.resolverPeriodo(dto);
    const pagamentos = await this.databaseService.buscarCaixaPagamentos(
      periodo.unit,
      periodo.start,
      periodo.end,
      periodo.filtrarFlagBaixa,
    );

    return {
      unit: periodo.unit,
      start: periodo.start,
      end: periodo.end,
      pagamentos,
    };
  }

  async buscarItens(dto: CaixaPeriodoDto): Promise<CaixaItensResponse> {
    const periodo = this.resolverPeriodo(dto);
    const itens = await this.databaseService.buscarCaixaItens(
      periodo.unit,
      periodo.start,
      periodo.end,
      periodo.filtrarFlagBaixa,
    );

    return {
      unit: periodo.unit,
      start: periodo.start,
      end: periodo.end,
      itens,
    };
  }

  async buscarRequisicoesPagas(
    dto: CaixaPeriodoDto,
  ): Promise<CaixaRequisicoesPagasResponse> {
    const periodo = this.resolverPeriodo(dto);
    const requisicoes = await this.databaseService.buscarCaixaRequisicoesPagas(
      periodo.unit,
      periodo.start,
      periodo.end,
    );

    return {
      unit: periodo.unit,
      start: periodo.start,
      end: periodo.end,
      requisicoes,
    };
  }

  async buscarFechamentoDia(
    dto: CaixaPeriodoDto,
  ): Promise<CaixaFechamentoDiaResponse> {
    const periodo = this.resolverPeriodo(dto);
    const resumo = await this.databaseService.buscarCaixaFechamentoDia(
      periodo.unit,
      periodo.start,
      periodo.end,
      periodo.filtrarFlagBaixa,
    );

    const totalLiquido = resumo.reduce(
      (acc, row) => acc + Number(row.total_liquido ?? 0),
      0,
    );

    return {
      unit: periodo.unit,
      start: periodo.start,
      end: periodo.end,
      resumo,
      totalLiquido: Math.round(totalLiquido * 100) / 100,
    };
  }

  resolverPeriodo(dto: CaixaPeriodoDto): CaixaPeriodoResolvido {
    if (!Number.isInteger(dto.unit) || dto.unit <= 0) {
      throw new BadRequestException('unit deve ser um inteiro maior que zero');
    }

    if (dto.date) {
      return {
        unit: dto.unit,
        start: dto.date,
        end: dto.date,
        filtrarFlagBaixa: dto.filtrarFlagBaixa === true,
      };
    }

    if (!dto.start || !dto.end) {
      throw new BadRequestException(
        'Informe date ou o par start/end no formato YYYY-MM-DD',
      );
    }

    if (dto.start > dto.end) {
      throw new BadRequestException('start não pode ser posterior a end');
    }

    return {
      unit: dto.unit,
      start: dto.start,
      end: dto.end,
      filtrarFlagBaixa: dto.filtrarFlagBaixa === true,
    };
  }
}
