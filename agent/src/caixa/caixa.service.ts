import { BadRequestException, Injectable, Logger } from '@nestjs/common';
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
  nrrquCupomComPaga: number;
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
  private readonly logger = new Logger(CaixaService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async buscarPagamentos(dto: CaixaPeriodoDto): Promise<CaixaPagamentosResponse> {
    const periodo = this.resolverPeriodo(dto);
    const t0 = Date.now();
    this.logger.log(
      `Caixa pagamentos início unit=${periodo.unit} ${periodo.start}..${periodo.end}`,
    );
    const pagamentos = await this.databaseService.buscarCaixaPagamentos(
      periodo.unit,
      periodo.start,
      periodo.end,
      periodo.filtrarFlagBaixa,
    );
    this.logger.log(
      `Caixa pagamentos fim unit=${periodo.unit} ${pagamentos.length} linha(s) ${Date.now() - t0}ms`,
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
    const t0 = Date.now();
    this.logger.log(
      `Caixa itens início unit=${periodo.unit} ${periodo.start}..${periodo.end}`,
    );
    const itens = await this.databaseService.buscarCaixaItens(
      periodo.unit,
      periodo.start,
      periodo.end,
      periodo.filtrarFlagBaixa,
    );
    this.logger.log(
      `Caixa itens fim unit=${periodo.unit} ${itens.length} linha(s) ${Date.now() - t0}ms`,
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
    const t0 = Date.now();
    this.logger.log(
      `Caixa requisicoes-pagas início unit=${periodo.unit} ${periodo.start}..${periodo.end}`,
    );
    const [requisicoes, nrrquCupomComPaga] = await Promise.all([
      this.databaseService.buscarCaixaRequisicoesPagas(
        periodo.unit,
        periodo.start,
        periodo.end,
      ),
      this.databaseService.contarNrrquCupomComPaga(
        periodo.unit,
        periodo.start,
        periodo.end,
      ),
    ]);
    this.logger.log(
      `Caixa requisicoes-pagas fim unit=${periodo.unit} ${requisicoes.length} linha(s) cupomComPaga=${nrrquCupomComPaga} ${Date.now() - t0}ms`,
    );

    return {
      unit: periodo.unit,
      start: periodo.start,
      end: periodo.end,
      requisicoes,
      nrrquCupomComPaga,
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
