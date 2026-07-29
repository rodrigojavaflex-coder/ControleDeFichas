import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProducaoEtapaResumo } from '../producao-etapas/entities/producao-etapa-resumo.entity';
import { ProducaoEtapaRemuneracao } from '../producao-config/entities/producao-etapa-remuneracao.entity';
import { ProducaoFuncionarioEtapa } from '../producao-config/entities/producao-funcionario-etapa.entity';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import {
  assertUnidadeFiltroProdutividade,
  assertUnidadeProducao,
  creditarProducaoResumoUnidadesExtras,
  unidadeCadastroUsuarioProducao,
  unidadesResumoProdutividade,
} from '../folha/utils/folha-unidade-scope.util';
import { funcionarioElegivelProdutividadeNoPeriodo } from '../folha/utils/folha-competencia.util';
import {
  PRODUCAO_COD_ETAPA_GESTAO,
  isCodEtapaGestao,
} from '../../common/constants/producao-gestao.constants';
import { getUsuarioPermissoes } from '../../common/utils/usuario-permissoes.util';
import { Permission } from '../../common/enums/permission.enum';
import {
  ProdutividadeAnaliticoLinhaDto,
  ProdutividadeAnaliticoResponseDto,
} from './dto/produtividade-analitico-response.dto';
import {
  ProdutividadeConsultaResponseDto,
  ProdutividadeFuncionarioRowDto,
  ProdutividadeFuncionarioSemCadastroDto,
  ProdutividadeFuncionarioSemEtapaVinculadaDto,
  ProdutividadeTotalColunaEtapaDto,
} from './dto/produtividade-response.dto';

interface AggEtapaConsolidada {
  codEtapa: string;
  etapa: string;
  quantidade: number;
  valorTotal: number;
}

interface AccFuncionarioConsolidado {
  funcionario: Funcionario;
  codigosErp: Set<number>;
  unidadesCadastro: Set<Unidade>;
  unidadesResumo: Set<Unidade>;
  etapas: Map<string, AggEtapaConsolidada>;
}

interface AccSemCadastro {
  codigoErp: number;
  nomes: Map<string, number>;
  unidades: Map<Unidade, number>;
  amostrasRequisicoes: Set<string>;
  totalLinhas: number;
}

interface AccSemEtapaVinculada {
  codigoErp: number;
  funcionarioId: string;
  nome: string;
  unidades: Map<Unidade, number>;
  etapas: Map<string, { etapa: string; linhas: number }>;
  totalLinhas: number;
}

const LIMITE_AVISOS_SEM_CADASTRO = 50;
const LIMITE_AVISOS_SEM_ETAPA = 50;
const LIMITE_AMOSTRAS_REQUISICAO_AVISO = 5;

interface EscopoProdutividadeConsulta {
  /** Resumo importado + remuneração por etapa. */
  unidadesResumo: Unidade[];
  /** Cadastro de funcionários exibido/contabilizado (`cdusu` por unidade). */
  unidadesFuncionarios: Unidade[];
}

@Injectable()
export class ProducaoProdutividadeService {
  constructor(
    @InjectRepository(ProducaoEtapaResumo)
    private readonly resumoRepo: Repository<ProducaoEtapaResumo>,
    @InjectRepository(ProducaoEtapaRemuneracao)
    private readonly etapaRemuneracaoRepo: Repository<ProducaoEtapaRemuneracao>,
    @InjectRepository(ProducaoFuncionarioEtapa)
    private readonly funcionarioEtapaRepo: Repository<ProducaoFuncionarioEtapa>,
    @InjectRepository(Funcionario)
    private readonly funcionarioRepo: Repository<Funcionario>,
  ) {}

  async consultar(
    usuario: Usuario,
    unidadesQuery: Unidade[] | undefined,
    dataInicio: string,
    dataFim: string,
    unidadeLegado?: Unidade,
  ): Promise<ProdutividadeConsultaResponseDto> {
    const escopo = this.resolverEscopoConsulta(
      usuario,
      unidadesQuery,
      unidadeLegado,
    );

    if (dataInicio > dataFim) {
      throw new BadRequestException(
        'dataInicio não pode ser posterior a dataFim.',
      );
    }

    return this.consultarConsolidado(usuario, escopo, dataInicio, dataFim);
  }

  async consultarAnalitico(
    usuario: Usuario,
    unidadesQuery: Unidade[] | undefined,
    dataInicio: string,
    dataFim: string,
    unidadeLegado?: Unidade,
  ): Promise<ProdutividadeAnaliticoResponseDto> {
    const escopo = this.resolverEscopoConsulta(
      usuario,
      unidadesQuery,
      unidadeLegado,
    );

    if (dataInicio > dataFim) {
      throw new BadRequestException(
        'dataInicio não pode ser posterior a dataFim.',
      );
    }

    return this.consultarAnaliticoLinhas(
      usuario,
      escopo,
      dataInicio,
      dataFim,
    );
  }

  private resolverEscopoConsulta(
    usuario: Usuario,
    unidadesQuery: Unidade[] | undefined,
    unidadeLegado?: Unidade,
  ): EscopoProdutividadeConsulta {
    const solicitadas =
      unidadesQuery?.length && unidadesQuery.length > 0
        ? unidadesQuery
        : unidadeLegado
          ? [unidadeLegado]
          : [];

    const unidadeUsuario = unidadeCadastroUsuarioProducao(usuario);

    if (unidadeUsuario) {
      for (const un of solicitadas) {
        assertUnidadeFiltroProdutividade(usuario, un);
      }

      const unidadesResumo = unidadesResumoProdutividade(usuario);
      if (!unidadesResumo?.length) {
        throw new BadRequestException('Escopo de produção indisponível.');
      }

      return {
        unidadesResumo,
        unidadesFuncionarios: [unidadeUsuario],
      };
    }

    const alvo =
      solicitadas.length > 0
        ? solicitadas
        : (() => {
            throw new BadRequestException('Informe ao menos uma unidade.');
          })();

    const unicas = [...new Set(alvo)];
    return {
      unidadesResumo: unicas,
      unidadesFuncionarios: unicas,
    };
  }

  /**
   * Contabilização: resumo das `unidadesResumo`; funcionários só de
   * `unidadesFuncionarios` (`codigoUsuarioErp` único por unidade de cadastro).
   */
  private async consultarConsolidado(
    usuario: Usuario,
    escopo: EscopoProdutividadeConsulta,
    dataInicio: string,
    dataFim: string,
  ): Promise<ProdutividadeConsultaResponseDto> {
    const { unidadesResumo, unidadesFuncionarios } = escopo;

    for (const unidade of unidadesResumo) {
      assertUnidadeProducao(usuario, unidade);
    }

    const remuneradas = await this.etapaRemuneracaoRepo.find({
      where: { unidade: In(unidadesResumo), recebe: true },
    });
    const remuneracaoPorUnidadeEtapa = new Map<
      string,
      { valor: number; etapa: string }
    >();
    for (const item of remuneradas) {
      remuneracaoPorUnidadeEtapa.set(`${item.unidade}:${item.codEtapa}`, {
        valor: Number(item.valor) || 0,
        etapa: item.etapa,
      });
    }

    const funcionarios = await this.funcionarioRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.cargo', 'cargo')
      .leftJoinAndSelect('f.setor', 'setor')
      .where('f.unidade IN (:...unidadesFuncionarios)', {
        unidadesFuncionarios,
      })
      .andWhere('f.codigoUsuarioErp IS NOT NULL')
      .getMany();

    const funcionariosPorCodErp = new Map<number, Funcionario[]>();
    for (const funcionario of funcionarios) {
      if (funcionario.codigoUsuarioErp == null) continue;
      const cod = funcionario.codigoUsuarioErp;
      const lista = funcionariosPorCodErp.get(cod) ?? [];
      lista.push(funcionario);
      funcionariosPorCodErp.set(cod, lista);
    }

    const funcEtapas = await this.funcionarioEtapaRepo.find({
      where: { unidade: In(unidadesFuncionarios), recebe: true },
      relations: ['funcionario'],
    });
    const funcEtapaSet = new Set(
      funcEtapas
        .filter(
          (fe) =>
            fe.funcionario?.id &&
            unidadesFuncionarios.includes(fe.funcionario.unidade),
        )
        .map((fe) => `${fe.funcionario!.id}:${fe.codEtapa}`),
    );

    const linhasResumo = await this.resumoRepo
      .createQueryBuilder('r')
      .where('r.unidade IN (:...unidadesResumo)', { unidadesResumo })
      .andWhere('r.dataSaida >= :dataInicio', { dataInicio })
      .andWhere('r.dataSaida <= :dataFim', { dataFim })
      .andWhere('r.usuarioSaida IS NOT NULL')
      .getMany();

    const aggPorCodErp = new Map<number, AccFuncionarioConsolidado>();
    const semCadastroPorCodErp = new Map<number, AccSemCadastro>();
    const semEtapaVinculadaPorCodErp = new Map<number, AccSemEtapaVinculada>();
    let linhasContabilizadas = 0;
    let linhasSemFuncionario = 0;
    let linhasEtapaNaoConfigurada = 0;
    const totalContabilizadoPorCodEtapa = new Map<string, number>();
    /** Conclusões remuneradas no resumo (escopo unidadesResumo), sem filtro de cadastro de funcionário. */
    const totalRemuneradoResumoPorCodEtapa = new Map<string, number>();
    const nomeEtapaPorCodEtapa = new Map<string, string>();
    /** Total da etapa base para GESTÃO: mesmo universo que `totalRemuneradoResumoPorCodEtapa`. */
    const totalBaseGestaoPorCodEtapa = new Map<string, number>();

    const creditarResumoOutrasUnidades = creditarProducaoResumoUnidadesExtras(
      unidadesResumo,
      unidadesFuncionarios,
    );
    const consultaMultiplasUnidadesResumo = unidadesResumo.length > 1;

    for (const row of linhasResumo) {
      const codFunc = row.usuarioSaida;
      if (codFunc == null) continue;

      if (!isCodEtapaGestao(row.codEtapa)) {
        const remBase = remuneracaoPorUnidadeEtapa.get(
          `${row.unidade}:${row.codEtapa}`,
        );
        if (remBase) {
          const qtd =
            (totalRemuneradoResumoPorCodEtapa.get(row.codEtapa) ?? 0) + 1;
          totalRemuneradoResumoPorCodEtapa.set(row.codEtapa, qtd);
          totalBaseGestaoPorCodEtapa.set(row.codEtapa, qtd);
          if (!nomeEtapaPorCodEtapa.has(row.codEtapa)) {
            nomeEtapaPorCodEtapa.set(
              row.codEtapa,
              remBase.etapa || row.etapa,
            );
          }
        }
      }

      const funcionario = this.resolverFuncionarioPorCodErp(
        codFunc,
        row.unidade,
        funcionariosPorCodErp,
        creditarResumoOutrasUnidades,
        consultaMultiplasUnidadesResumo,
      );
      if (
        !funcionario ||
        !funcionarioElegivelProdutividadeNoPeriodo(funcionario, dataInicio)
      ) {
        if (!funcionario) {
          linhasSemFuncionario += 1;
          this.registrarSemCadastro(semCadastroPorCodErp, codFunc, row);
        }
        continue;
      }

      const rem = remuneracaoPorUnidadeEtapa.get(
        `${row.unidade}:${row.codEtapa}`,
      );
      if (!rem) {
        linhasEtapaNaoConfigurada += 1;
        continue;
      }

      if (!funcEtapaSet.has(`${funcionario.id}:${row.codEtapa}`)) {
        linhasEtapaNaoConfigurada += 1;
        this.registrarSemEtapaVinculada(
          semEtapaVinculadaPorCodErp,
          funcionario,
          row,
          rem.etapa || row.etapa,
        );
        continue;
      }

      if (isCodEtapaGestao(row.codEtapa)) {
        continue;
      }

      linhasContabilizadas += 1;
      totalContabilizadoPorCodEtapa.set(
        row.codEtapa,
        (totalContabilizadoPorCodEtapa.get(row.codEtapa) ?? 0) + 1,
      );

      const chaveAgg = funcionario.codigoUsuarioErp as number;
      let acc = aggPorCodErp.get(chaveAgg);
      if (!acc) {
        acc = {
          funcionario,
          codigosErp: new Set<number>(),
          unidadesCadastro: new Set<Unidade>(),
          unidadesResumo: new Set<Unidade>(),
          etapas: new Map<string, AggEtapaConsolidada>(),
        };
        aggPorCodErp.set(chaveAgg, acc);
      }

      acc.unidadesResumo.add(row.unidade);
      const candidatos = funcionariosPorCodErp.get(chaveAgg) ?? [funcionario];
      for (const c of candidatos) {
        acc.unidadesCadastro.add(c.unidade);
        acc.codigosErp.add(c.codigoUsuarioErp as number);
      }

      const existente = acc.etapas.get(row.codEtapa);
      if (existente) {
        existente.quantidade += 1;
        existente.valorTotal += rem.valor;
      } else {
        acc.etapas.set(row.codEtapa, {
          codEtapa: row.codEtapa,
          etapa: rem.etapa || row.etapa,
          quantidade: 1,
          valorTotal: rem.valor,
        });
      }
    }

    await this.aplicarGestaoConsolidada(
      unidadesFuncionarios,
      unidadesResumo,
      dataInicio,
      aggPorCodErp,
      remuneracaoPorUnidadeEtapa,
      totalBaseGestaoPorCodEtapa,
    );

    const funcionariosRows: ProdutividadeFuncionarioRowDto[] = [];

    for (const acc of aggPorCodErp.values()) {
      if (
        !funcionarioElegivelProdutividadeNoPeriodo(acc.funcionario, dataInicio)
      ) {
        continue;
      }
      const etapas = [...acc.etapas.values()]
        .map((e) => ({
          codEtapa: e.codEtapa,
          etapa: e.etapa,
          quantidade: e.quantidade,
          valorUnitario: e.quantidade > 0 ? e.valorTotal / e.quantidade : 0,
          valorTotal: e.valorTotal,
        }))
        .sort((a, b) => a.etapa.localeCompare(b.etapa, 'pt-BR'));

      const totalQuantidade = etapas.reduce((s, e) => s + e.quantidade, 0);
      const totalValor = etapas.reduce((s, e) => s + e.valorTotal, 0);
      const codigos = [...acc.codigosErp].sort((a, b) => a - b);
      const unidadesFuncionario = [
        ...new Set([...acc.unidadesCadastro, ...acc.unidadesResumo]),
      ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

      funcionariosRows.push({
        funcionarioId: acc.funcionario.id,
        unidades: unidadesFuncionario,
        nome: acc.funcionario.nome,
        codigoUsuarioErp: codigos[0],
        codigosUsuarioErp: codigos.length > 1 ? codigos : undefined,
        setor: acc.funcionario.setor?.descricao?.trim() || null,
        cargo: acc.funcionario.cargo?.descricao?.trim() || null,
        totalQuantidade,
        totalValor,
        etapas,
      });
    }

    funcionariosRows.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const totalQuantidade = funcionariosRows.reduce(
      (s, f) => s + f.totalQuantidade,
      0,
    );
    const totalValor = funcionariosRows.reduce((s, f) => s + f.totalValor, 0);
    const totaisColunaEtapas = this.montarTotaisColunaEtapas(
      totalRemuneradoResumoPorCodEtapa,
      nomeEtapaPorCodEtapa,
      aggPorCodErp,
      remuneracaoPorUnidadeEtapa,
    );

    const podeVerAlertas = this.usuarioPodeVerAlertas(usuario);
    const avisos = podeVerAlertas
      ? this.montarAvisos(
          semCadastroPorCodErp,
          semEtapaVinculadaPorCodErp,
          linhasSemFuncionario,
        )
      : this.avisosVazios();

    return {
      unidades: unidadesResumo,
      dataInicio,
      dataFim,
      resumo: {
        linhasResumo: linhasResumo.length,
        linhasContabilizadas,
        linhasSemFuncionario: podeVerAlertas ? linhasSemFuncionario : 0,
        linhasEtapaNaoConfigurada: podeVerAlertas
          ? linhasEtapaNaoConfigurada
          : 0,
        totalQuantidade,
        totalValor,
        totalFuncionarios: funcionariosRows.length,
      },
      avisos,
      funcionarios: funcionariosRows,
      totaisColunaEtapas,
    };
  }

  private montarTotaisColunaEtapas(
    totalRemuneradoResumoPorCodEtapa: Map<string, number>,
    nomeEtapaPorCodEtapa: Map<string, string>,
    aggPorCodErp: Map<number, AccFuncionarioConsolidado>,
    remuneracaoPorUnidadeEtapa: Map<string, { valor: number; etapa: string }>,
  ): ProdutividadeTotalColunaEtapaDto[] {
    const itens: ProdutividadeTotalColunaEtapaDto[] = [];

    for (const [codEtapa, quantidade] of totalRemuneradoResumoPorCodEtapa) {
      if (quantidade <= 0 || isCodEtapaGestao(codEtapa)) continue;
      itens.push({
        codEtapa,
        etapa: nomeEtapaPorCodEtapa.get(codEtapa) ?? codEtapa,
        quantidade,
      });
    }

    let qtdGestao = 0;
    let nomeGestao = 'GESTÃO';
    for (const acc of aggPorCodErp.values()) {
      const g = acc.etapas.get(PRODUCAO_COD_ETAPA_GESTAO);
      if (g) {
        qtdGestao += g.quantidade;
        if (g.etapa?.trim()) nomeGestao = g.etapa.trim();
      }
    }
    if (qtdGestao > 0) {
      for (const [key, rem] of remuneracaoPorUnidadeEtapa) {
        if (key.endsWith(`:${PRODUCAO_COD_ETAPA_GESTAO}`)) {
          if (rem.etapa?.trim()) nomeGestao = rem.etapa.trim();
          break;
        }
      }
      itens.push({
        codEtapa: PRODUCAO_COD_ETAPA_GESTAO,
        etapa: nomeGestao,
        quantidade: qtdGestao,
      });
    }

    itens.sort((a, b) => {
      if (a.codEtapa === PRODUCAO_COD_ETAPA_GESTAO) return 1;
      if (b.codEtapa === PRODUCAO_COD_ETAPA_GESTAO) return -1;
      return a.etapa.localeCompare(b.etapa, 'pt-BR');
    });

    return itens;
  }

  private async consultarAnaliticoLinhas(
    usuario: Usuario,
    escopo: EscopoProdutividadeConsulta,
    dataInicio: string,
    dataFim: string,
  ): Promise<ProdutividadeAnaliticoResponseDto> {
    const { unidadesResumo, unidadesFuncionarios } = escopo;

    for (const unidade of unidadesResumo) {
      assertUnidadeProducao(usuario, unidade);
    }

    const remuneradas = await this.etapaRemuneracaoRepo.find({
      where: { unidade: In(unidadesResumo), recebe: true },
    });
    const remuneracaoPorUnidadeEtapa = new Map<
      string,
      { valor: number; etapa: string }
    >();
    for (const item of remuneradas) {
      remuneracaoPorUnidadeEtapa.set(`${item.unidade}:${item.codEtapa}`, {
        valor: Number(item.valor) || 0,
        etapa: item.etapa,
      });
    }

    const funcionarios = await this.funcionarioRepo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.cargo', 'cargo')
      .leftJoinAndSelect('f.setor', 'setor')
      .where('f.unidade IN (:...unidadesFuncionarios)', {
        unidadesFuncionarios,
      })
      .andWhere('f.codigoUsuarioErp IS NOT NULL')
      .getMany();

    const funcionariosPorCodErp = new Map<number, Funcionario[]>();
    for (const funcionario of funcionarios) {
      if (funcionario.codigoUsuarioErp == null) continue;
      const cod = funcionario.codigoUsuarioErp;
      const lista = funcionariosPorCodErp.get(cod) ?? [];
      lista.push(funcionario);
      funcionariosPorCodErp.set(cod, lista);
    }

    const funcEtapas = await this.funcionarioEtapaRepo.find({
      where: { unidade: In(unidadesFuncionarios), recebe: true },
      relations: ['funcionario'],
    });
    const funcEtapaSet = new Set(
      funcEtapas
        .filter(
          (fe) =>
            fe.funcionario?.id &&
            unidadesFuncionarios.includes(fe.funcionario.unidade),
        )
        .map((fe) => `${fe.funcionario!.id}:${fe.codEtapa}`),
    );

    const linhasResumo = await this.resumoRepo
      .createQueryBuilder('r')
      .where('r.unidade IN (:...unidadesResumo)', { unidadesResumo })
      .andWhere('r.dataSaida >= :dataInicio', { dataInicio })
      .andWhere('r.dataSaida <= :dataFim', { dataFim })
      .andWhere('r.usuarioSaida IS NOT NULL')
      .getMany();

    const linhas: ProdutividadeAnaliticoLinhaDto[] = [];

    const creditarResumoOutrasUnidades = creditarProducaoResumoUnidadesExtras(
      unidadesResumo,
      unidadesFuncionarios,
    );
    const consultaMultiplasUnidadesResumo = unidadesResumo.length > 1;

    for (const row of linhasResumo) {
      const codFunc = row.usuarioSaida;
      if (codFunc == null) continue;

      const funcionario = this.resolverFuncionarioPorCodErp(
        codFunc,
        row.unidade,
        funcionariosPorCodErp,
        creditarResumoOutrasUnidades,
        consultaMultiplasUnidadesResumo,
      );
      if (
        !funcionario ||
        !funcionarioElegivelProdutividadeNoPeriodo(funcionario, dataInicio)
      ) {
        continue;
      }

      const rem = remuneracaoPorUnidadeEtapa.get(
        `${row.unidade}:${row.codEtapa}`,
      );
      if (!rem) continue;

      if (!funcEtapaSet.has(`${funcionario.id}:${row.codEtapa}`)) continue;

      linhas.push({
        funcionarioId: funcionario.id,
        funcionario: funcionario.nome?.trim() || 'Nome não informado',
        unidade: row.unidade,
        codEtapa: row.codEtapa,
        etapa: rem.etapa || row.etapa,
        requisicao: row.requisicao,
        formula: row.formula,
        data: row.dataSaida ?? '',
      });
    }

    linhas.sort((a, b) => {
      const byNome = a.funcionario.localeCompare(b.funcionario, 'pt-BR');
      if (byNome !== 0) return byNome;
      const byEtapa = a.etapa.localeCompare(b.etapa, 'pt-BR');
      if (byEtapa !== 0) return byEtapa;
      const byData = a.data.localeCompare(b.data);
      if (byData !== 0) return byData;
      if (a.requisicao !== b.requisicao) return a.requisicao - b.requisicao;
      return a.formula.localeCompare(b.formula, 'pt-BR');
    });

    return {
      unidades: unidadesResumo,
      dataInicio,
      dataFim,
      linhas,
    };
  }

  private registrarSemCadastro(
    mapa: Map<number, AccSemCadastro>,
    codigoErp: number,
    row: ProducaoEtapaResumo,
  ): void {
    let acc = mapa.get(codigoErp);
    if (!acc) {
      acc = {
        codigoErp,
        nomes: new Map<string, number>(),
        unidades: new Map<Unidade, number>(),
        amostrasRequisicoes: new Set<string>(),
        totalLinhas: 0,
      };
      mapa.set(codigoErp, acc);
    }
    acc.totalLinhas += 1;
    acc.unidades.set(row.unidade, (acc.unidades.get(row.unidade) ?? 0) + 1);
    if (acc.amostrasRequisicoes.size < LIMITE_AMOSTRAS_REQUISICAO_AVISO) {
      const amostra = this.formatarAmostraRequisicao(row);
      if (amostra) {
        acc.amostrasRequisicoes.add(amostra);
      }
    }
  }

  private registrarSemEtapaVinculada(
    mapa: Map<number, AccSemEtapaVinculada>,
    funcionario: Funcionario,
    row: ProducaoEtapaResumo,
    nomeEtapa: string,
  ): void {
    const codigoErp = funcionario.codigoUsuarioErp as number;
    let acc = mapa.get(codigoErp);
    if (!acc) {
      acc = {
        codigoErp,
        funcionarioId: funcionario.id,
        nome: funcionario.nome?.trim() || 'Nome não informado no cadastro',
        unidades: new Map<Unidade, number>(),
        etapas: new Map<string, { etapa: string; linhas: number }>(),
        totalLinhas: 0,
      };
      mapa.set(codigoErp, acc);
    }
    acc.totalLinhas += 1;
    acc.unidades.set(row.unidade, (acc.unidades.get(row.unidade) ?? 0) + 1);
    const etapaAcc = acc.etapas.get(row.codEtapa);
    if (etapaAcc) {
      etapaAcc.linhas += 1;
    } else {
      acc.etapas.set(row.codEtapa, {
        etapa: nomeEtapa?.trim() || row.codEtapa,
        linhas: 1,
      });
    }
  }

  private async aplicarGestaoConsolidada(
    unidadesFuncionarios: Unidade[],
    unidadesResumo: Unidade[],
    dataInicio: string,
    aggPorCodErp: Map<number, AccFuncionarioConsolidado>,
    remuneracaoPorUnidadeEtapa: Map<string, { valor: number; etapa: string }>,
    totalBaseGestaoPorCodEtapa: Map<string, number>,
  ): Promise<void> {
    const gestaoConfigs = await this.funcionarioEtapaRepo.find({
      where: {
        unidade: In(unidadesFuncionarios),
        codEtapa: PRODUCAO_COD_ETAPA_GESTAO,
        recebe: true,
      },
      relations: ['funcionario', 'funcionario.cargo', 'funcionario.setor'],
    });

    if (gestaoConfigs.length === 0) {
      return;
    }

    const gestaoAplicada = new Set<string>();

    for (const gc of gestaoConfigs) {
      const ref = gc.codEtapaReferencia?.trim();
      const funcionario = gc.funcionario;
      if (
        !ref ||
        funcionario?.codigoUsuarioErp == null ||
        !unidadesFuncionarios.includes(funcionario.unidade) ||
        !funcionarioElegivelProdutividadeNoPeriodo(funcionario, dataInicio)
      ) {
        continue;
      }

      const codErp = funcionario.codigoUsuarioErp;
      const chaveDedupe = `${codErp}:${ref}`;
      if (gestaoAplicada.has(chaveDedupe)) continue;

      const remGestao = remuneracaoPorUnidadeEtapa.get(
        `${gc.unidade}:${PRODUCAO_COD_ETAPA_GESTAO}`,
      );
      if (!remGestao) continue;

      const qtd = totalBaseGestaoPorCodEtapa.get(ref) ?? 0;
      if (qtd <= 0) continue;

      gestaoAplicada.add(chaveDedupe);

      let acc = aggPorCodErp.get(codErp);
      if (!acc) {
        acc = {
          funcionario,
          codigosErp: new Set<number>([codErp]),
          unidadesCadastro: new Set<Unidade>([funcionario.unidade]),
          unidadesResumo: new Set<Unidade>(),
          etapas: new Map<string, AggEtapaConsolidada>(),
        };
        aggPorCodErp.set(codErp, acc);
      }

      acc.etapas.set(PRODUCAO_COD_ETAPA_GESTAO, {
        codEtapa: PRODUCAO_COD_ETAPA_GESTAO,
        etapa: remGestao.etapa || 'GESTÃO',
        quantidade: qtd,
        valorTotal: qtd * remGestao.valor,
      });
    }
  }

  private usuarioPodeVerAlertas(usuario: Usuario): boolean {
    return getUsuarioPermissoes(usuario).includes(
      Permission.PRODUCAO_PRODUTIVIDADE_READ_ALERTAS,
    );
  }

  private avisosVazios(): {
    totalLinhasSemCadastro: number;
    funcionariosSemCadastro: ProdutividadeFuncionarioSemCadastroDto[];
    funcionariosSemCadastroOcultos: number;
    totalLinhasSemEtapaVinculada: number;
    funcionariosSemEtapaVinculada: ProdutividadeFuncionarioSemEtapaVinculadaDto[];
    funcionariosSemEtapaVinculadaOcultos: number;
  } {
    return {
      totalLinhasSemCadastro: 0,
      funcionariosSemCadastro: [],
      funcionariosSemCadastroOcultos: 0,
      totalLinhasSemEtapaVinculada: 0,
      funcionariosSemEtapaVinculada: [],
      funcionariosSemEtapaVinculadaOcultos: 0,
    };
  }

  private montarAvisos(
    semCadastro: Map<number, AccSemCadastro>,
    semEtapaVinculada: Map<number, AccSemEtapaVinculada>,
    totalLinhasSemCadastro: number,
  ): {
    totalLinhasSemCadastro: number;
    funcionariosSemCadastro: ProdutividadeFuncionarioSemCadastroDto[];
    funcionariosSemCadastroOcultos: number;
    totalLinhasSemEtapaVinculada: number;
    funcionariosSemEtapaVinculada: ProdutividadeFuncionarioSemEtapaVinculadaDto[];
    funcionariosSemEtapaVinculadaOcultos: number;
  } {
    const listaSemCadastro = [...semCadastro.values()]
      .map((acc) => this.mapSemCadastro(acc))
      .sort((a, b) => {
        const byLinhas = b.totalLinhas - a.totalLinhas;
        if (byLinhas !== 0) return byLinhas;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });

    const exibidosSemCadastro = listaSemCadastro.slice(
      0,
      LIMITE_AVISOS_SEM_CADASTRO,
    );

    const listaSemEtapa = [...semEtapaVinculada.values()]
      .map((acc) => this.mapSemEtapaVinculada(acc))
      .sort((a, b) => {
        const byLinhas = b.totalLinhas - a.totalLinhas;
        if (byLinhas !== 0) return byLinhas;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });

    const exibidosSemEtapa = listaSemEtapa.slice(0, LIMITE_AVISOS_SEM_ETAPA);
    const totalLinhasSemEtapaVinculada = listaSemEtapa.reduce(
      (s, item) => s + item.totalLinhas,
      0,
    );

    return {
      totalLinhasSemCadastro,
      funcionariosSemCadastro: exibidosSemCadastro,
      funcionariosSemCadastroOcultos: Math.max(
        0,
        listaSemCadastro.length - exibidosSemCadastro.length,
      ),
      totalLinhasSemEtapaVinculada,
      funcionariosSemEtapaVinculada: exibidosSemEtapa,
      funcionariosSemEtapaVinculadaOcultos: Math.max(
        0,
        listaSemEtapa.length - exibidosSemEtapa.length,
      ),
    };
  }

  private mapSemCadastro(
    acc: AccSemCadastro,
  ): ProdutividadeFuncionarioSemCadastroDto {
    return {
      codigoErp: acc.codigoErp,
      nome: this.nomeMaisFrequente(acc.nomes) || `Usuário ERP ${acc.codigoErp}`,
      unidades: [...acc.unidades.entries()]
        .map(([unidade, linhas]) => ({ unidade, linhas }))
        .sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR')),
      amostrasRequisicoes: [...acc.amostrasRequisicoes].sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
      totalLinhas: acc.totalLinhas,
    };
  }

  private formatarAmostraRequisicao(row: ProducaoEtapaResumo): string {
    const formula = row.formula?.trim() || '0';
    const etapa =
      row.etapa?.trim() || row.codEtapa?.trim() || 'Etapa não informada';
    return `${row.requisicao}-${formula} ${etapa}`;
  }

  private mapSemEtapaVinculada(
    acc: AccSemEtapaVinculada,
  ): ProdutividadeFuncionarioSemEtapaVinculadaDto {
    return {
      codigoErp: acc.codigoErp,
      funcionarioId: acc.funcionarioId,
      nome: acc.nome,
      unidades: [...acc.unidades.entries()]
        .map(([unidade, linhas]) => ({ unidade, linhas }))
        .sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR')),
      etapas: [...acc.etapas.entries()]
        .map(([codEtapa, item]) => ({
          codEtapa,
          etapa: item.etapa,
          linhas: item.linhas,
        }))
        .sort((a, b) => {
          const byLinhas = b.linhas - a.linhas;
          if (byLinhas !== 0) return byLinhas;
          return a.etapa.localeCompare(b.etapa, 'pt-BR');
        }),
      totalLinhas: acc.totalLinhas,
    };
  }

  private nomeMaisFrequente(nomes: Map<string, number>): string {
    let melhor = '';
    let max = 0;
    for (const [nome, qtd] of nomes.entries()) {
      if (qtd > max) {
        max = qtd;
        melhor = nome;
      }
    }
    return melhor || 'Nome não informado no resumo';
  }

  /**
   * Cadastro por unidade; com resumo ampliado credita pelo `cdusu` no cadastro local.
   */
  private resolverFuncionarioPorCodErp(
    usuarioSaida: number,
    unidadeResumo: Unidade,
    funcionariosPorCodErp: Map<number, Funcionario[]>,
    creditarResumoOutrasUnidades: boolean,
    consultaMultiplasUnidadesResumo: boolean,
  ): Funcionario | undefined {
    const candidatos = funcionariosPorCodErp.get(usuarioSaida);
    if (!candidatos?.length) return undefined;

    const porUnidade = candidatos.find((f) => f.unidade === unidadeResumo);
    if (porUnidade) return porUnidade;

    if (creditarResumoOutrasUnidades || consultaMultiplasUnidadesResumo) {
      if (candidatos.length === 1) return candidatos[0];
    }

    return undefined;
  }
}
