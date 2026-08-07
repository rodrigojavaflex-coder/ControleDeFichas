import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { ProducaoEtapaResumo } from '../producao-etapas/entities/producao-etapa-resumo.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import {
  assertUnidadeProducao,
  unidadesPermitidasProdutividade,
} from '../folha/utils/folha-unidade-scope.util';
import {
  AcompanhamentoDetalheResponseDto,
  AcompanhamentoEtapaResumoDto,
  AcompanhamentoLinhaFilaDto,
  AcompanhamentoLocalizarResponseDto,
  AcompanhamentoResumoResponseDto,
} from './dto/acompanhamento-response.dto';
import {
  chaveRequisicaoFormula,
} from './utils/fila-etapa.util';
import { ProducaoCalendarioService } from '../producao-config/producao-calendario.service';
import { minutosDecorridosProducaoDesdeEntrada } from '../producao-config/utils/producao-calendario.util';

@Injectable()
export class ProducaoAcompanhamentoService {
  constructor(
    @InjectRepository(ProducaoEtapaResumo)
    private readonly resumoRepo: Repository<ProducaoEtapaResumo>,
    @InjectRepository(Funcionario)
    private readonly funcionarioRepo: Repository<Funcionario>,
    private readonly calendarioService: ProducaoCalendarioService,
  ) {}

  async consultarResumo(
    usuario: Usuario,
    unidadesQuery: Unidade[] | undefined,
    unidadeLegado?: Unidade,
  ): Promise<AcompanhamentoResumoResponseDto> {
    const unidades = this.resolverUnidadesConsulta(
      usuario,
      unidadesQuery,
      unidadeLegado,
    );
    const consultadoEm = new Date().toISOString();
    const agora = new Date(consultadoEm);
    const linhas = await this.buscarFilaEmAndamento(unidades);
    const mapaCalendarios =
      await this.calendarioService.mapaCalendariosPorUnidade(unidades);

    const porEtapa = new Map<
      string,
      {
        codEtapa: string;
        etapa: string;
        posicaoEtapa: number;
        chaves: Set<string>;
        minutos: number[];
      }
    >();

    for (const row of linhas) {
      const cod = row.codEtapa;
      const entrada = this.resolverEntradaFila(row);
      let agg = porEtapa.get(cod);
      if (!agg) {
        agg = {
          codEtapa: cod,
          etapa: row.etapa,
          posicaoEtapa: row.posicaoEtapa,
          chaves: new Set(),
          minutos: [],
        };
        porEtapa.set(cod, agg);
      }
      if (row.posicaoEtapa > agg.posicaoEtapa) {
        agg.posicaoEtapa = row.posicaoEtapa;
      }
      if (row.etapa?.trim()) {
        agg.etapa = row.etapa;
      }
      agg.chaves.add(
        chaveRequisicaoFormula(
          row.unidade,
          row.filial,
          row.requisicao,
          row.formula,
        ),
      );
      agg.minutos.push(
        minutosDecorridosProducaoDesdeEntrada(
          entrada.data,
          entrada.hora,
          agora,
          mapaCalendarios.get(row.unidade),
        ),
      );
    }

    const etapas: AcompanhamentoEtapaResumoDto[] = [...porEtapa.values()]
      .map((agg) => ({
        codEtapa: agg.codEtapa,
        etapa: agg.etapa,
        posicaoEtapa: agg.posicaoEtapa,
        totalRequisicoesFormulas: agg.chaves.size,
        tempoMedioMinutos:
          agg.minutos.length > 0
            ? Math.round(
                (agg.minutos.reduce((a, b) => a + b, 0) / agg.minutos.length) *
                  10,
              ) / 10
            : null,
      }))
      .filter((e) => e.totalRequisicoesFormulas > 0)
      .sort((a, b) => a.posicaoEtapa - b.posicaoEtapa);

    return { unidades, etapas, consultadoEm };
  }

  async localizarRequisicaoFormula(
    usuario: Usuario,
    requisicao: number,
    formula: string,
    unidadesQuery: Unidade[] | undefined,
    unidadeLegado?: Unidade,
    filial?: number,
  ): Promise<AcompanhamentoLocalizarResponseDto> {
    const unidades = this.resolverUnidadesConsulta(
      usuario,
      unidadesQuery,
      unidadeLegado,
    );
    const formulaNorm = this.normalizarFormulaConsulta(formula);
    if (!formulaNorm) {
      throw new BadRequestException('Informe a fórmula.');
    }

    const linhas = await this.buscarFilaEmAndamento(unidades);
    const match = linhas.find(
      (row) =>
        row.requisicao === requisicao &&
        this.normalizarFormulaConsulta(row.formula) === formulaNorm &&
        (filial == null || row.filial === filial),
    );

    if (!match) {
      throw new NotFoundException(
        'Requisição-fórmula não está em andamento na fila de nenhuma etapa (unidades selecionadas).',
      );
    }

    return {
      codEtapa: match.codEtapa,
      etapa: match.etapa?.trim() || match.codEtapa,
      posicaoEtapa: match.posicaoEtapa,
      unidade: match.unidade,
      filial: match.filial,
      requisicao: match.requisicao,
      formula: match.formula,
    };
  }

  async consultarDetalhe(
    usuario: Usuario,
    codEtapa: string,
    unidadesQuery: Unidade[] | undefined,
    unidadeLegado?: Unidade,
  ): Promise<AcompanhamentoDetalheResponseDto> {
    const unidades = this.resolverUnidadesConsulta(
      usuario,
      unidadesQuery,
      unidadeLegado,
    );
    const cod = codEtapa.trim();
    if (!cod) {
      throw new BadRequestException('Informe codEtapa.');
    }

    const consultadoEm = new Date().toISOString();
    const agora = new Date(consultadoEm);
    const linhasDb = await this.buscarFilaEmAndamento(unidades, cod);
    const mapaCalendarios =
      await this.calendarioService.mapaCalendariosPorUnidade(unidades);

    if (linhasDb.length === 0) {
      return {
        codEtapa: cod,
        etapa: cod,
        posicaoEtapa: 0,
        unidades,
        linhas: [],
        consultadoEm,
      };
    }

    const posicaoEtapa = Math.max(...linhasDb.map((r) => r.posicaoEtapa));
    const etapa = linhasDb.find((r) => r.etapa?.trim())?.etapa?.trim() ?? cod;

    const codigosErp = [
      ...new Set(
        linhasDb
          .map((r) => this.resolverEntradaFila(r).usuario)
          .filter((c): c is number => c != null),
      ),
    ];
    const nomesPorUnidadeCodErp =
      await this.mapaNomesFuncionarioPorUnidadeCodErp(unidades, codigosErp);

    const linhas: AcompanhamentoLinhaFilaDto[] = linhasDb
      .map((row) => {
        const entrada = this.resolverEntradaFila(row);
        return {
          unidade: row.unidade,
          filial: row.filial,
          requisicao: row.requisicao,
          formula: row.formula,
          usuarioEntrada: entrada.usuario ?? null,
          funcionario:
            entrada.usuario != null
              ? (nomesPorUnidadeCodErp.get(
                  `${row.unidade}:${entrada.usuario}`,
                ) ?? null)
              : null,
          dataEntrada: entrada.data ?? null,
          horaEntrada: entrada.hora ?? null,
          tempoDecorridoMinutos: minutosDecorridosProducaoDesdeEntrada(
            entrada.data,
            entrada.hora,
            agora,
            mapaCalendarios.get(row.unidade),
          ),
          cliente: row.cliente ?? null,
          paciente: row.paciente ?? null,
          dataRetirada: row.dataRetirada ?? null,
        };
      })
      .sort((a, b) => {
        const ta = a.tempoDecorridoMinutos;
        const tb = b.tempoDecorridoMinutos;
        if (tb !== ta) return tb - ta;
        return (
          a.requisicao - b.requisicao || a.formula.localeCompare(b.formula)
        );
      });

    return {
      codEtapa: cod,
      etapa,
      posicaoEtapa,
      unidades,
      linhas,
      consultadoEm,
    };
  }

  private async mapaNomesFuncionarioPorUnidadeCodErp(
    unidades: Unidade[],
    codigosErp: number[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (codigosErp.length === 0) {
      return map;
    }

    const funcionarios = await this.funcionarioRepo.find({
      where: {
        unidade: In(unidades),
        codigoUsuarioErp: In(codigosErp),
      },
    });

    for (const f of funcionarios) {
      if (f.codigoUsuarioErp == null) {
        continue;
      }
      const nome = f.nome?.trim();
      map.set(
        `${f.unidade}:${f.codigoUsuarioErp}`,
        nome || 'Nome não informado',
      );
    }

    return map;
  }

  private resolverEntradaFila(row: ProducaoEtapaResumo): {
    data: string | null | undefined;
    hora: string | null | undefined;
    usuario: number | null | undefined;
  } {
    if (row.emAndamentoFila && row.dataEntradaFila) {
      return {
        data: row.dataEntradaFila,
        hora: row.horaEntradaFila,
        usuario: row.usuarioEntradaFila,
      };
    }
    return {
      data: row.dataEntrada,
      hora: row.horaEntrada,
      usuario: row.usuarioEntrada,
    };
  }

  private async buscarFilaEmAndamento(
    unidades: Unidade[],
    codEtapa?: string,
  ): Promise<ProducaoEtapaResumo[]> {
    return this.resumoRepo.find({
      where: {
        unidade: In(unidades),
        emAndamentoFila: true,
        dataEntradaFila: Not(IsNull()),
        ...(codEtapa ? { codEtapa } : {}),
      },
      order: { posicaoEtapa: 'ASC', requisicao: 'ASC', formula: 'ASC' },
    });
  }

  private resolverUnidadesConsulta(
    usuario: Usuario,
    unidadesQuery: Unidade[] | undefined,
    unidadeLegado?: Unidade,
  ): Unidade[] {
    const solicitadas =
      unidadesQuery?.length && unidadesQuery.length > 0
        ? unidadesQuery
        : unidadeLegado
          ? [unidadeLegado]
          : [];

    const permitidas = unidadesPermitidasProdutividade(usuario);
    const alvo = solicitadas.length > 0 ? solicitadas : (permitidas ?? []);

    if (alvo.length === 0) {
      throw new BadRequestException('Informe ao menos uma unidade.');
    }

    const unicas = [...new Set(alvo)];
    for (const unidade of unicas) {
      assertUnidadeProducao(usuario, unidade);
    }
    return unicas;
  }

  private normalizarFormulaConsulta(formula: string): string {
    const t = String(formula ?? '').trim();
    if (!t) {
      return '';
    }
    if (/^\d+$/.test(t)) {
      return String(Number(t));
    }
    return t;
  }
}
