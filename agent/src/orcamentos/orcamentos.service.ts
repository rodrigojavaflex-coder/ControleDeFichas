import {
  Injectable,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { OrcamentoExclusaoRow, OrcamentoRow } from '../database/database.types';
import {
  arredondarMoeda,
  compararSerieOrcamento,
  linhaAtivoOrcamento,
  textoEmbalagemOrcamento,
} from './orcamento-imagem-texto.util';

export interface OrcamentoComposicaoAtivo {
  descricao: string;
  quantidade: number;
  unidade: string;
  linha: string;
}

export interface OrcamentoComposicaoFormula {
  serieo: string;
  ativos: OrcamentoComposicaoAtivo[];
  embalagem: string;
  valor: number;
  desconto: number;
}

export interface OrcamentoComposicao {
  paciente: string;
  cdfil: number;
  nrorc: number;
  numero: string;
  formulas: OrcamentoComposicaoFormula[];
  subtotal: number;
  desconto: number;
  total: number;
}

@Injectable()
export class OrcamentosService {
  private readonly logger = new Logger(OrcamentosService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async buscarComposicao(
    unit: number,
    nrorc: number,
    serieo?: string,
  ): Promise<OrcamentoComposicao> {
    if (!unit || unit <= 0) {
      throw new BadRequestException(
        'unit deve ser um número válido maior que zero',
      );
    }
    if (!nrorc || nrorc <= 0) {
      throw new BadRequestException(
        'nrorc deve ser um número válido maior que zero',
      );
    }

    const serie = serieo?.trim() ?? '';
    const inicio = Date.now();
    const { formulas, ativos } =
      await this.databaseService.buscarComposicaoOrcamento(unit, nrorc);

    if (formulas.length === 0) {
      throw new NotFoundException('Orçamento não encontrado nesta unidade.');
    }

    const serieNormalizada = serie.toUpperCase();
    const escolhidas = serie
      ? formulas.filter(
          (formula) => formula.serieo.toUpperCase() === serieNormalizada,
        )
      : formulas;
    if (serie && escolhidas.length === 0) {
      throw new NotFoundException('Fórmula não encontrada neste orçamento.');
    }

    const ativosPorSerie = new Map<string, typeof ativos>();
    for (const ativo of ativos) {
      const lista = ativosPorSerie.get(ativo.serieo) ?? [];
      lista.push(ativo);
      ativosPorSerie.set(ativo.serieo, lista);
    }

    const formulasImagem = [...escolhidas]
      .sort((a, b) => compararSerieOrcamento(a.serieo, b.serieo))
      .map((formula) => {
        const componentes = (ativosPorSerie.get(formula.serieo) ?? [])
          .filter((ativo) => ativo.descricao)
          .sort((a, b) => a.itemid - b.itemid)
          .map((ativo) => ({
            descricao: ativo.descricao,
            quantidade: ativo.quantidade,
            unidade: ativo.unidade,
            linha: linhaAtivoOrcamento(
              ativo.descricao,
              ativo.quantidade,
              ativo.unidade,
            ),
          }));
        return {
          serieo: formula.serieo,
          ativos: componentes,
          embalagem: textoEmbalagemOrcamento(formula),
          valor: arredondarMoeda(formula.precoCobrado),
          desconto: arredondarMoeda(formula.desconto),
        };
      });

    const subtotal = arredondarMoeda(
      formulasImagem.reduce((soma, formula) => soma + formula.valor, 0),
    );
    const desconto = arredondarMoeda(
      formulasImagem.reduce((soma, formula) => soma + formula.desconto, 0),
    );
    const paciente =
      escolhidas.find((formula) => formula.paciente)?.paciente ?? '';

    this.logger.log(
      `Composição ${unit}-${nrorc}${serie ? ` série ${serie}` : ''}: ${formulasImagem.length} fórmula(s) em ${Date.now() - inicio}ms`,
    );

    return {
      paciente,
      cdfil: unit,
      nrorc,
      numero: `${unit}-${nrorc}`,
      formulas: formulasImagem,
      subtotal,
      desconto,
      total: arredondarMoeda(subtotal - desconto),
    };
  }

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
    this.validarPeriodo(unit, start, end);
    return this.databaseService.buscarOrcamentosPorPeriodo(unit, start, end);
  }

  async buscarExclusoesOrcamentos(
    unit: number,
    start: string,
    end: string,
  ): Promise<OrcamentoExclusaoRow[]> {
    this.validarPeriodo(unit, start, end);
    return this.databaseService.buscarExclusoesOrcamentos(unit, start, end);
  }

  private validarPeriodo(unit: number, start: string, end: string): void {
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
  }
}
