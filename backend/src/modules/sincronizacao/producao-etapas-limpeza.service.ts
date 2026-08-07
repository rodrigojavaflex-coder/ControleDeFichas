import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProducaoEtapaResumo } from '../producao-etapas/entities/producao-etapa-resumo.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import {
  FormulaAmostraLimpezaDto,
  LimparProducaoEtapasAntigasDto,
  LimparProducaoEtapasAntigasResponseDto,
  ListarFormulasSemFimLimpezaResponseDto,
  ProducaoEtapaDisponivelDto,
} from './dto/limpar-producao-etapas-antigas.dto';

@Injectable()
export class ProducaoEtapasLimpezaService {
  private readonly logger = new Logger(ProducaoEtapasLimpezaService.name);

  constructor(
    @InjectRepository(ProducaoEtapaResumo)
    private readonly etapaRepo: Repository<ProducaoEtapaResumo>,
    private readonly dataSource: DataSource,
  ) {}

  async listarEtapasDisponiveis(
    unidade: Unidade,
  ): Promise<ProducaoEtapaDisponivelDto[]> {
    const rows = await this.etapaRepo
      .createQueryBuilder('e')
      .select('e.codEtapa', 'codEtapa')
      .addSelect('MIN(e.etapa)', 'etapa')
      .addSelect('MIN(e.posicaoEtapa)', 'posicaoEtapa')
      .where('e.unidade = :unidade', { unidade })
      .groupBy('e.codEtapa')
      .orderBy('MIN(e.posicaoEtapa)', 'ASC')
      .addOrderBy('MIN(e.etapa)', 'ASC')
      .getRawMany<{
        codEtapa: string;
        etapa: string;
        posicaoEtapa: string | number;
      }>();

    return rows.map((r) => ({
      codEtapa: String(r.codEtapa).trim(),
      etapa: String(r.etapa ?? '').trim(),
      posicaoEtapa: Number(r.posicaoEtapa) || 0,
    }));
  }

  async preview(
    dto: LimparProducaoEtapasAntigasDto,
  ): Promise<LimparProducaoEtapasAntigasResponseDto> {
    const params = this.normalizarDto(dto);
    return this.montarResposta(params, false);
  }

  async listarFormulasSemFim(
    dto: LimparProducaoEtapasAntigasDto,
  ): Promise<ListarFormulasSemFimLimpezaResponseDto> {
    const params = this.normalizarDto(dto);
    const formulas = await this.consultarFormulasSemFim(
      params.unidade,
      params.dataLimite,
      params.etapasFinais,
      null,
    );
    return {
      unidade: params.unidade,
      dataLimite: params.dataLimite,
      etapasFinais: params.etapasFinais,
      total: formulas.length,
      formulas,
    };
  }

  async executar(
    dto: LimparProducaoEtapasAntigasDto,
  ): Promise<LimparProducaoEtapasAntigasResponseDto> {
    const params = this.normalizarDto(dto);
    const preview = await this.montarResposta(params, false);

    const started = Date.now();
    const result = await this.dataSource.transaction(async (manager) => {
      const abertos = await manager.query(
        `
        WITH deleted AS (
          DELETE FROM producao_etapas_resumo
          WHERE unidade = $1
            AND "dataEntrada" IS NOT NULL
            AND "dataSaida" IS NULL
            AND "dataEntrada" <= $2::date
          RETURNING id
        )
        SELECT COUNT(*)::int AS qtd FROM deleted
        `,
        [params.unidade, params.dataLimite],
      );

      const fila = await manager.query(
        `
        WITH deleted AS (
          DELETE FROM producao_etapas_resumo
          WHERE unidade = $1
            AND "emAndamentoFila" = true
            AND "dataEntradaFila" IS NOT NULL
            AND "dataEntradaFila" <= $2::date
          RETURNING id
        )
        SELECT COUNT(*)::int AS qtd FROM deleted
        `,
        [params.unidade, params.dataLimite],
      );

      const formulas = await manager.query(
        `
        WITH alvo AS (
          SELECT filial, requisicao, formula
          FROM producao_etapas_resumo
          WHERE unidade = $1
          GROUP BY filial, requisicao, formula
          HAVING MIN("dataEntrada") IS NOT NULL
             AND MIN("dataEntrada") <= $2::date
             AND NOT BOOL_OR(
                   "codEtapa" = ANY($3::varchar[])
                   AND NULLIF(TRIM(COALESCE("dataSaida"::text, '')), '') IS NOT NULL
                 )
        ),
        deleted AS (
          DELETE FROM producao_etapas_resumo r
          USING alvo a
          WHERE r.unidade = $1
            AND a.filial = r.filial
            AND a.requisicao = r.requisicao
            AND a.formula = r.formula
          RETURNING r.id
        )
        SELECT COUNT(*)::int AS qtd FROM deleted
        `,
        [params.unidade, params.dataLimite, params.etapasFinais],
      );

      return {
        linhasAbertos: Number(abertos?.[0]?.qtd ?? 0),
        linhasFila: Number(fila?.[0]?.qtd ?? 0),
        linhasFormulasSemFim: Number(formulas?.[0]?.qtd ?? 0),
      };
    });

    const ms = Date.now() - started;
    this.logger.log(
      `Limpeza etapas ${params.unidade} dataLimite=${params.dataLimite} ` +
        `etapasFinais=[${params.etapasFinais.join(',')}] ` +
        `abertos=${result.linhasAbertos} fila=${result.linhasFila} ` +
        `formulasSemFimLinhas=${result.linhasFormulasSemFim} ` +
        `(preview formulas=${preview.formulasSemFim}) em ${ms}ms`,
    );

    return {
      ...preview,
      linhasAbertos: result.linhasAbertos,
      linhasFila: result.linhasFila,
      linhasFormulasSemFim: result.linhasFormulasSemFim,
      totalLinhas:
        result.linhasAbertos +
        result.linhasFila +
        result.linhasFormulasSemFim,
      executado: true,
    };
  }

  private normalizarDto(dto: LimparProducaoEtapasAntigasDto): {
    unidade: Unidade;
    dataLimite: string;
    etapasFinais: string[];
  } {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.dataLimite)) {
      throw new BadRequestException(
        'dataLimite deve estar no formato YYYY-MM-DD.',
      );
    }

    const etapasFinais = [
      ...new Set(
        (dto.etapasFinais ?? [])
          .map((c) => String(c ?? '').trim())
          .filter(Boolean),
      ),
    ];
    if (!etapasFinais.length) {
      throw new BadRequestException(
        'Informe ao menos uma etapa final (codEtapa).',
      );
    }

    return {
      unidade: dto.unidade,
      dataLimite: dto.dataLimite,
      etapasFinais,
    };
  }

  private async montarResposta(
    params: {
      unidade: Unidade;
      dataLimite: string;
      etapasFinais: string[];
    },
    _executado: boolean,
  ): Promise<LimparProducaoEtapasAntigasResponseDto> {
    const [linhasAbertos, linhasFila, formulasSemFim, amostra] =
      await Promise.all([
        this.contarAbertos(params.unidade, params.dataLimite),
        this.contarFila(params.unidade, params.dataLimite),
        this.contarFormulasSemFim(
          params.unidade,
          params.dataLimite,
          params.etapasFinais,
        ),
        this.consultarFormulasSemFim(
          params.unidade,
          params.dataLimite,
          params.etapasFinais,
          20,
        ),
      ]);

    const linhasFormulasSemFim = await this.contarLinhasFormulasSemFim(
      params.unidade,
      params.dataLimite,
      params.etapasFinais,
    );

    return {
      unidade: params.unidade,
      dataLimite: params.dataLimite,
      etapasFinais: params.etapasFinais,
      linhasAbertos,
      linhasFila,
      formulasSemFim,
      linhasFormulasSemFim,
      totalLinhas: linhasAbertos + linhasFila + linhasFormulasSemFim,
      amostraFormulasSemFim: amostra,
    };
  }

  private async contarAbertos(
    unidade: Unidade,
    dataLimite: string,
  ): Promise<number> {
    const row = await this.dataSource.query(
      `
      SELECT COUNT(*)::int AS qtd
      FROM producao_etapas_resumo
      WHERE unidade = $1
        AND "dataEntrada" IS NOT NULL
        AND "dataSaida" IS NULL
        AND "dataEntrada" <= $2::date
      `,
      [unidade, dataLimite],
    );
    return Number(row?.[0]?.qtd ?? 0);
  }

  private async contarFila(
    unidade: Unidade,
    dataLimite: string,
  ): Promise<number> {
    const row = await this.dataSource.query(
      `
      SELECT COUNT(*)::int AS qtd
      FROM producao_etapas_resumo
      WHERE unidade = $1
        AND "emAndamentoFila" = true
        AND "dataEntradaFila" IS NOT NULL
        AND "dataEntradaFila" <= $2::date
      `,
      [unidade, dataLimite],
    );
    return Number(row?.[0]?.qtd ?? 0);
  }

  private async contarFormulasSemFim(
    unidade: Unidade,
    dataLimite: string,
    etapasFinais: string[],
  ): Promise<number> {
    const row = await this.dataSource.query(
      `
      SELECT COUNT(*)::int AS qtd
      FROM (
        SELECT 1
        FROM producao_etapas_resumo
        WHERE unidade = $1
        GROUP BY filial, requisicao, formula
        HAVING MIN("dataEntrada") IS NOT NULL
           AND MIN("dataEntrada") <= $2::date
           AND NOT BOOL_OR(
                 "codEtapa" = ANY($3::varchar[])
                 AND NULLIF(TRIM(COALESCE("dataSaida"::text, '')), '') IS NOT NULL
               )
      ) t
      `,
      [unidade, dataLimite, etapasFinais],
    );
    return Number(row?.[0]?.qtd ?? 0);
  }

  private async contarLinhasFormulasSemFim(
    unidade: Unidade,
    dataLimite: string,
    etapasFinais: string[],
  ): Promise<number> {
    const row = await this.dataSource.query(
      `
      WITH alvo AS (
        SELECT filial, requisicao, formula
        FROM producao_etapas_resumo
        WHERE unidade = $1
        GROUP BY filial, requisicao, formula
        HAVING MIN("dataEntrada") IS NOT NULL
           AND MIN("dataEntrada") <= $2::date
           AND NOT BOOL_OR(
                 "codEtapa" = ANY($3::varchar[])
                 AND NULLIF(TRIM(COALESCE("dataSaida"::text, '')), '') IS NOT NULL
               )
      )
      SELECT COUNT(*)::int AS qtd
      FROM producao_etapas_resumo r
      JOIN alvo a
        ON a.filial = r.filial
       AND a.requisicao = r.requisicao
       AND a.formula = r.formula
      WHERE r.unidade = $1
      `,
      [unidade, dataLimite, etapasFinais],
    );
    return Number(row?.[0]?.qtd ?? 0);
  }

  private async consultarFormulasSemFim(
    unidade: Unidade,
    dataLimite: string,
    etapasFinais: string[],
    limite: number | null,
  ): Promise<FormulaAmostraLimpezaDto[]> {
    const sqlBase = `
      SELECT
        filial,
        requisicao,
        formula,
        MIN("dataEntrada")::text AS "minDataEntrada"
      FROM producao_etapas_resumo
      WHERE unidade = $1
      GROUP BY filial, requisicao, formula
      HAVING MIN("dataEntrada") IS NOT NULL
         AND MIN("dataEntrada") <= $2::date
         AND NOT BOOL_OR(
               "codEtapa" = ANY($3::varchar[])
               AND NULLIF(TRIM(COALESCE("dataSaida"::text, '')), '') IS NOT NULL
             )
      ORDER BY MIN("dataEntrada"), requisicao, formula
    `;
    const rows =
      limite == null
        ? await this.dataSource.query(sqlBase, [
            unidade,
            dataLimite,
            etapasFinais,
          ])
        : await this.dataSource.query(`${sqlBase} LIMIT $4`, [
            unidade,
            dataLimite,
            etapasFinais,
            limite,
          ]);

    return (rows as Array<Record<string, unknown>>).map((r) => ({
      filial: Number(r.filial),
      requisicao: Number(r.requisicao),
      formula: String(r.formula ?? ''),
      minDataEntrada: r.minDataEntrada
        ? String(r.minDataEntrada).slice(0, 10)
        : null,
    }));
  }

}
