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
import {
  chaveAlertaSemCadastro,
  codigoCreditoSaida,
  codigoExibicaoFuncionario,
  construirMapasFuncionarios,
  ProducaoCodigoCredito,
  resolverFuncionarioProducao,
  rotuloCodigoCredito,
} from '../producao-etapas/utils/producao-funcionario-erp.util';

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
  credito: ProducaoCodigoCredito;
  nomes: Map<string, number>;
  unidades: Map<Unidade, number>;
  amostrasRequisicoes: Set<string>;
  totalLinhas: number;
}

interface AccSemEtapaVinculada {
  funcionarioId: string;
  nome: string;
  codigoExibicao: number | null;
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
  /** Cadastro de funcionários exibido/contabilizado (`cdusu`/`cdfun` por unidade). */
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
   * `unidadesFuncionarios` (`codigoUsuarioErp` / `codigoFuncionarioErp` por unidade).
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
      .andWhere(
        '(f.codigoUsuarioErp IS NOT NULL OR f.codigoFuncionarioErp IS NOT NULL)',
      )
      .getMany();

    const mapasFuncionarios = construirMapasFuncionarios(funcionarios);

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
      .andWhere(
        '(r.usuarioSaida IS NOT NULL OR r.funcionarioSaida IS NOT NULL)',
      )
      .getMany();

    const aggPorFuncionario = new Map<string, AccFuncionarioConsolidado>();
    const semCadastroPorChave = new Map<string, AccSemCadastro>();
    const semEtapaVinculadaPorFuncionario = new Map<
      string,
      AccSemEtapaVinculada
    >();
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
      const credito = codigoCreditoSaida(row);
      if (!credito) continue;

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

      const funcionario = resolverFuncionarioProducao(
        credito,
        row.unidade,
        mapasFuncionarios,
        creditarResumoOutrasUnidades,
        consultaMultiplasUnidadesResumo,
      );
      if (
        !funcionario ||
        !funcionarioElegivelProdutividadeNoPeriodo(funcionario, dataInicio)
      ) {
        if (!funcionario) {
          linhasSemFuncionario += 1;
          this.registrarSemCadastro(semCadastroPorChave, credito, row);
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
          semEtapaVinculadaPorFuncionario,
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

      const chaveAgg = funcionario.id;
      let acc = aggPorFuncionario.get(chaveAgg);
      if (!acc) {
        acc = {
          funcionario,
          codigosErp: new Set<number>(),
          unidadesCadastro: new Set<Unidade>(),
          unidadesResumo: new Set<Unidade>(),
          etapas: new Map<string, AggEtapaConsolidada>(),
        };
        aggPorFuncionario.set(chaveAgg, acc);
      }

      acc.unidadesResumo.add(row.unidade);
      acc.unidadesCadastro.add(funcionario.unidade);
      const codExibicao = codigoExibicaoFuncionario(funcionario);
      if (codExibicao != null) {
        acc.codigosErp.add(codExibicao);
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
      aggPorFuncionario,
      remuneracaoPorUnidadeEtapa,
      totalBaseGestaoPorCodEtapa,
    );

    const funcionariosRows: ProdutividadeFuncionarioRowDto[] = [];

    for (const acc of aggPorFuncionario.values()) {
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
      const codigoPrincipal = codigoExibicaoFuncionario(acc.funcionario);
      const unidadesFuncionario = [
        ...new Set([...acc.unidadesCadastro, ...acc.unidadesResumo]),
      ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

      funcionariosRows.push({
        funcionarioId: acc.funcionario.id,
        unidades: unidadesFuncionario,
        nome: acc.funcionario.nome,
        codigoUsuarioErp: acc.funcionario.codigoUsuarioErp ?? null,
        codigoFuncionarioErp: acc.funcionario.codigoFuncionarioErp ?? null,
        codigoExibicaoErp: codigoPrincipal,
        codigosUsuarioErp:
          codigos.length > 1 && acc.funcionario.codigoUsuarioErp != null
            ? codigos
            : undefined,
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
      aggPorFuncionario,
      remuneracaoPorUnidadeEtapa,
    );

    const podeVerAlertas = this.usuarioPodeVerAlertas(usuario);
    const avisos = podeVerAlertas
      ? this.montarAvisos(
          semCadastroPorChave,
          semEtapaVinculadaPorFuncionario,
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
    aggPorFuncionario: Map<string, AccFuncionarioConsolidado>,
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
    for (const acc of aggPorFuncionario.values()) {
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
      .andWhere(
        '(f.codigoUsuarioErp IS NOT NULL OR f.codigoFuncionarioErp IS NOT NULL)',
      )
      .getMany();

    const mapasFuncionarios = construirMapasFuncionarios(funcionarios);

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
      .andWhere(
        '(r.usuarioSaida IS NOT NULL OR r.funcionarioSaida IS NOT NULL)',
      )
      .getMany();

    const linhas: ProdutividadeAnaliticoLinhaDto[] = [];

    const creditarResumoOutrasUnidades = creditarProducaoResumoUnidadesExtras(
      unidadesResumo,
      unidadesFuncionarios,
    );
    const consultaMultiplasUnidadesResumo = unidadesResumo.length > 1;

    for (const row of linhasResumo) {
      const credito = codigoCreditoSaida(row);
      if (!credito) continue;

      const funcionario = resolverFuncionarioProducao(
        credito,
        row.unidade,
        mapasFuncionarios,
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
    mapa: Map<string, AccSemCadastro>,
    credito: ProducaoCodigoCredito,
    row: ProducaoEtapaResumo,
  ): void {
    const chave = chaveAlertaSemCadastro(credito);
    let acc = mapa.get(chave);
    if (!acc) {
      acc = {
        credito,
        nomes: new Map<string, number>(),
        unidades: new Map<Unidade, number>(),
        amostrasRequisicoes: new Set<string>(),
        totalLinhas: 0,
      };
      mapa.set(chave, acc);
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
    mapa: Map<string, AccSemEtapaVinculada>,
    funcionario: Funcionario,
    row: ProducaoEtapaResumo,
    nomeEtapa: string,
  ): void {
    let acc = mapa.get(funcionario.id);
    if (!acc) {
      acc = {
        funcionarioId: funcionario.id,
        nome: funcionario.nome?.trim() || 'Nome não informado no cadastro',
        codigoExibicao: codigoExibicaoFuncionario(funcionario),
        unidades: new Map<Unidade, number>(),
        etapas: new Map<string, { etapa: string; linhas: number }>(),
        totalLinhas: 0,
      };
      mapa.set(funcionario.id, acc);
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
    aggPorFuncionario: Map<string, AccFuncionarioConsolidado>,
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
        !funcionario ||
        codigoExibicaoFuncionario(funcionario) == null ||
        !unidadesFuncionarios.includes(funcionario.unidade) ||
        !funcionarioElegivelProdutividadeNoPeriodo(funcionario, dataInicio)
      ) {
        continue;
      }

      const chaveDedupe = `${funcionario.id}:${ref}`;
      if (gestaoAplicada.has(chaveDedupe)) continue;

      const remGestao = remuneracaoPorUnidadeEtapa.get(
        `${gc.unidade}:${PRODUCAO_COD_ETAPA_GESTAO}`,
      );
      if (!remGestao) continue;

      const qtd = totalBaseGestaoPorCodEtapa.get(ref) ?? 0;
      if (qtd <= 0) continue;

      gestaoAplicada.add(chaveDedupe);

      let acc = aggPorFuncionario.get(funcionario.id);
      if (!acc) {
        const codExibicao = codigoExibicaoFuncionario(funcionario);
        acc = {
          funcionario,
          codigosErp: new Set<number>(
            codExibicao != null ? [codExibicao] : [],
          ),
          unidadesCadastro: new Set<Unidade>([funcionario.unidade]),
          unidadesResumo: new Set<Unidade>(),
          etapas: new Map<string, AggEtapaConsolidada>(),
        };
        aggPorFuncionario.set(funcionario.id, acc);
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
    semCadastro: Map<string, AccSemCadastro>,
    semEtapaVinculada: Map<string, AccSemEtapaVinculada>,
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
      codigoErp: acc.credito.codigo,
      tipoCodigoErp: acc.credito.tipo,
      nome:
        this.nomeMaisFrequente(acc.nomes) || rotuloCodigoCredito(acc.credito),
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
      codigoErp: acc.codigoExibicao ?? 0,
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
}
