import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Unidade } from '../../common/enums/unidade.enum';
import { ComercialAcompanhamentoItemDto } from '../comercial-acompanhamento/dto/comercial-acompanhamento.dto';
import { ComercialAcompanhamentoService } from '../comercial-acompanhamento/comercial-acompanhamento.service';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  assertUnidadeFolha,
  unidadeEscopoUsuarioFolha,
} from '../folha/utils/folha-unidade-scope.util';
import { ymdHojeSp } from '../visitacao-acompanhamento/utils/visitacao-dias-uteis.util';
import {
  PeriodoAnalise,
  SemanaAnalise,
  COMERCIAL_ANALISE_ANO_MIN,
  listarCompetenciasAnalise,
  parseCompetenciaKey,
  parSemanasFechadasHome,
  semanasDaCompetencia,
  semanasMesCorrente,
} from './comercial-analise-periodo.util';
import {
  ComercialAnaliseBase,
  ComercialAnaliseDimensao,
  ComercialAnaliseLeitura,
  ComercialAnaliseMetrica,
  FindComercialAnaliseDto,
} from './dto/find-comercial-analise.dto';
import {
  ComercialAnaliseFiltrosAplicadosDto,
  ComercialAnaliseLinhaDto,
  ComercialAnaliseOpcoesResponseDto,
  ComercialAnalisePeriodoDto,
  ComercialAnaliseResponseDto,
} from './dto/comercial-analise-response.dto';
import {
  ComercialAnaliseHomeDestaqueDto,
  ComercialAnaliseHomeResponseDto,
  ComercialAnaliseHomeRejeitadoDto,
  ComercialAnaliseHomeUnidadeCardDto,
} from './dto/comercial-analise-home.dto';

type Par = { valor: number; qtd: number };

type Recorte = {
  inicio: string;
  fimRecebido: string;
  fimRejeitado: string;
};

type MapaItens = Map<string, ComercialAcompanhamentoItemDto>;

@Injectable()
export class ComercialAnaliseService {
  private readonly logger = new Logger(ComercialAnaliseService.name);

  constructor(
    private readonly acompanhamento: ComercialAcompanhamentoService,
  ) {}

  async opcoes(
    usuario: Usuario,
    unidadeFiltro?: Unidade,
    competenciaSemanasFiltro?: string,
  ): Promise<ComercialAnaliseOpcoesResponseDto> {
    const escopo = unidadeEscopoUsuarioFolha(usuario);
    const unidadesDisponiveis = this.unidadesDoEscopo(usuario);
    const unidade = escopo ?? unidadeFiltro ?? null;
    if (unidade) assertUnidadeFolha(usuario, unidade);
    const hoje = ymdHojeSp();
    const vendedores = unidade
      ? await this.acompanhamento.listarVendedoresOpcoes(usuario, unidade)
      : [];
    // Só competências com movimento nas lojas do escopo (ou na unidade filtrada).
    const unidadesMovimento = unidade ? [unidade] : unidadesDisponiveis;
    const calendario = listarCompetenciasAnalise(hoje);
    const comMovimento = unidadesMovimento.length
      ? await this.acompanhamento.listarAnoMesComMovimento(
          unidadesMovimento,
          calendario[0]?.inicio ?? `${COMERCIAL_ANALISE_ANO_MIN}-01-01`,
          hoje,
        )
      : new Set<string>();
    const competenciasRaw = calendario.filter((c) => comMovimento.has(c.key));
    const competencias = competenciasRaw.map((c) => this.paraPeriodo(c));
    const competenciaSemanas = this.resolverCompetenciaSemanas(
      competenciasRaw.map((c) => c.key),
      competenciaSemanasFiltro,
    );
    const semanas = competenciaSemanas
      ? semanasDaCompetencia(competenciaSemanas, hoje)
      : [];
    return {
      unidade,
      unidadesDisponiveis,
      escopoFixo: !!escopo,
      anoCorrente: Number(hoje.slice(0, 4)),
      competencias,
      competenciaSemanas,
      semanas: semanas.map((s) => this.paraSemana(s)),
      vendedores,
    };
  }

  /**
   * Resumo da home (RN-COM-009): Δ das 2 últimas semanas fechadas
   * (seg–dom; prévia corrente fora). Escopo fixo → 1 card; sem unidade →
   * um card por loja.
   */
  async resumoHome(usuario: Usuario): Promise<ComercialAnaliseHomeResponseDto> {
    const unidades = this.unidadesDoEscopo(usuario);
    if (!unidades.length) {
      throw new BadRequestException(
        'Nenhuma unidade disponível para o resumo da análise.',
      );
    }
    for (const u of unidades) {
      assertUnidadeFolha(usuario, u);
    }

    const hoje = ymdHojeSp();
    const par = parSemanasFechadasHome(hoje);
    if (!par) {
      throw new BadRequestException(
        'Não há semanas fechadas no período para analisar.',
      );
    }
    const { atual: semanaAtual, anterior: semanaAnterior } = par;

    const itens = await Promise.all(
      unidades.map((unidade) =>
        this.montarCardHomeUnidade(unidade, semanaAtual, semanaAnterior),
      ),
    );

    this.logger.debug(
      `resumoHome unidades=${unidades.join(',')} sAtual=${semanaAtual.key} temComparacao=${!!semanaAnterior}`,
    );

    return {
      semanaAtual: this.paraSemana(semanaAtual),
      semanaAnterior: semanaAnterior ? this.paraSemana(semanaAnterior) : null,
      temComparacao: !!semanaAnterior,
      itens,
    };
  }

  private async montarCardHomeUnidade(
    unidade: Unidade,
    semanaAtual: SemanaAnalise,
    semanaAnterior: SemanaAnalise | null,
  ): Promise<ComercialAnaliseHomeUnidadeCardDto> {
    const dimensao: ComercialAnaliseDimensao = 'vendedor';
    const metrica: ComercialAnaliseMetrica = 'valor';
    const base: ComercialAnaliseBase = 'totalVendido';
    const unidades: Unidade[] = [unidade];

    if (!semanaAnterior) {
      const [mapa] = await this.carregarVarios(
        unidades,
        [this.recorteSemana(semanaAtual)],
        dimensao,
      );
      return {
        unidade,
        maiorCrescimento: null,
        maiorQueda: null,
        maiorRejeitado: this.destaqueRejeitadoSemana(mapa),
      };
    }

    const [mapa1, mapa2] = await this.carregarVarios(
      unidades,
      [this.recorteSemana(semanaAnterior), this.recorteSemana(semanaAtual)],
      dimensao,
    );
    const ids = this.idsDe(mapa1, mapa2);
    const vendas = ids.map((id) =>
      this.linhaComparar(id, mapa1, mapa2, base, metrica),
    );

    return {
      unidade,
      maiorCrescimento: this.destaqueDeLinha(
        this.ordenarCrescimento(vendas)[0] ?? null,
      ),
      maiorQueda: this.destaqueDeLinha(this.ordenarQueda(vendas)[0] ?? null),
      maiorRejeitado: this.destaqueRejeitadoSemana(mapa2),
    };
  }

  async analisar(
    usuario: Usuario,
    dto: FindComercialAnaliseDto,
  ): Promise<ComercialAnaliseResponseDto> {
    const modo = dto.modo ?? 'comparar';
    const dimensao: ComercialAnaliseDimensao = dto.dimensao ?? 'vendedor';
    const metrica = dto.metrica ?? 'valor';
    const base = dto.base ?? 'totalVendido';
    const hoje = ymdHojeSp();
    const iniciouEm = Date.now();
    const unidades = this.resolverUnidadesAnalise(usuario, dto, dimensao);
    const funcionarioIds =
      dimensao === 'unidade' ? undefined : dto.funcionarioIds;

    let resposta: ComercialAnaliseResponseDto;
    if (modo === 'semanas') {
      resposta = await this.analisarSemanas(
        unidades,
        hoje,
        dto,
        dimensao,
        funcionarioIds,
        metrica,
        base,
      );
    } else if (modo === 'ranking' || modo === 'evolucao') {
      resposta = await this.analisarPeriodo(
        unidades,
        hoje,
        modo,
        dto.competencias ?? [],
        dimensao,
        funcionarioIds,
        metrica,
        base,
      );
    } else {
      resposta = await this.analisarComparar(
        unidades,
        hoje,
        dto.c1,
        dto.c2,
        dimensao,
        funcionarioIds,
        metrica,
        base,
      );
    }

    this.logger.log(
      `Análise comercial unidades=${unidades.join('|') || '-'} modo=${modo} dimensao=${dimensao} metrica=${metrica} base=${base} em ${Date.now() - iniciouEm}ms`,
    );
    return resposta;
  }

  private async analisarComparar(
    unidades: Unidade[],
    hoje: string,
    c1: string | undefined,
    c2: string | undefined,
    dimensao: ComercialAnaliseDimensao,
    funcionarioIds: string[] | undefined,
    metrica: ComercialAnaliseMetrica,
    base: ComercialAnaliseBase,
  ): Promise<ComercialAnaliseResponseDto> {
    const p1 = this.exigirCompetencia(c1, hoje, 'c1');
    const p2 = this.exigirCompetencia(c2, hoje, 'c2');
    if (p1.key === p2.key) {
      throw new BadRequestException(
        'Selecione duas competências diferentes.',
      );
    }
    const [mapa1, mapa2] = await this.carregarVarios(
      unidades,
      [this.recorteMes(p1), this.recorteMes(p2)],
      dimensao,
      funcionarioIds,
    );
    const ids = this.idsDe(mapa1, mapa2);
    const vendas = ids.map((id) =>
      this.linhaComparar(id, mapa1, mapa2, base, metrica),
    );
    const rejeitados = ids.map((id) =>
      this.linhaComparar(id, mapa1, mapa2, 'rejeitado', metrica),
    );
    const periodo1 = this.paraPeriodo(p1);
    const periodo2 = this.paraPeriodo(p2);
    return {
      unidade: unidades[0] ?? null,
      modo: 'comparar',
      periodos: [periodo1, periodo2],
      periodo1,
      periodo2,
      agregacao: null,
      filtrosAplicados: this.filtros(
        dimensao,
        unidades,
        funcionarioIds,
        metrica,
        base,
        null,
      ),
      crescimento: this.ordenarCrescimento(vendas),
      queda: this.ordenarQueda(vendas),
      maioresVendas: [],
      maioresRejeitados: this.ordenarDeltaDesc(rejeitados),
    };
  }

  private async analisarPeriodo(
    unidades: Unidade[],
    hoje: string,
    modo: 'ranking' | 'evolucao',
    keys: string[],
    dimensao: ComercialAnaliseDimensao,
    funcionarioIds: string[] | undefined,
    metrica: ComercialAnaliseMetrica,
    base: ComercialAnaliseBase,
  ): Promise<ComercialAnaliseResponseDto> {
    const periodos = keys.map((key) =>
      this.exigirCompetencia(key, hoje, 'competência'),
    );
    if (modo === 'evolucao' && periodos.length < 2) {
      throw new BadRequestException(
        'A evolução precisa de ao menos duas competências.',
      );
    }
    const mapas = await this.carregarVarios(
      unidades,
      periodos.map((p) => this.recorteMes(p)),
      dimensao,
      funcionarioIds,
    );
    const ids = this.idsDe(...mapas);
    const vendas = ids.map((id) =>
      this.linhaSerie(id, mapas, base, metrica, modo === 'ranking'),
    );
    const rejeitados = ids.map((id) =>
      this.linhaSerie(id, mapas, 'rejeitado', metrica, modo === 'ranking'),
    );
    return {
      unidade: unidades[0] ?? null,
      modo,
      periodos: periodos.map((p) => this.paraPeriodo(p)),
      periodo1: null,
      periodo2: null,
      agregacao: 'soma',
      filtrosAplicados: this.filtros(
        dimensao,
        unidades,
        funcionarioIds,
        metrica,
        base,
        null,
      ),
      crescimento: [],
      queda: [],
      maioresVendas: this.ordenarPeriodo(vendas),
      maioresRejeitados: this.ordenarPeriodo(rejeitados),
    };
  }

  private async analisarSemanas(
    unidades: Unidade[],
    hoje: string,
    dto: FindComercialAnaliseDto,
    dimensao: ComercialAnaliseDimensao,
    funcionarioIds: string[] | undefined,
    metrica: ComercialAnaliseMetrica,
    base: ComercialAnaliseBase,
  ): Promise<ComercialAnaliseResponseDto> {
    const leitura: ComercialAnaliseLeitura = dto.leitura ?? 'comparar';
    const competenciaKey = await this.resolverCompetenciaSemanasAnalise(
      unidades,
      hoje,
      dto.competencia,
    );
    const semanas = semanasDaCompetencia(competenciaKey, hoje);
    if (!semanas.length) {
      throw new BadRequestException(
        'Não há semanas na competência selecionada para analisar.',
      );
    }
    if (leitura === 'evolucao') {
      return this.evolucaoSemanas(
        unidades,
        semanas,
        dimensao,
        funcionarioIds,
        metrica,
        base,
      );
    }
    const s1 = this.resolverSemana(semanas, dto.s1, 0);
    const s2 = this.resolverSemana(semanas, dto.s2, 1);
    if (!s1 || !s2) {
      throw new BadRequestException(
        'A competência ainda não tem duas semanas para comparar.',
      );
    }
    if (s1.key === s2.key) {
      throw new BadRequestException('Selecione duas semanas diferentes.');
    }
    const [mapa1, mapa2] = await this.carregarVarios(
      unidades,
      [this.recorteSemana(s1), this.recorteSemana(s2)],
      dimensao,
      funcionarioIds,
    );
    const ids = this.idsDe(mapa1, mapa2);
    const vendas = ids.map((id) =>
      this.linhaComparar(id, mapa1, mapa2, base, metrica),
    );
    const rejeitados = ids.map((id) =>
      this.linhaComparar(id, mapa1, mapa2, 'rejeitado', metrica),
    );
    const periodo1 = this.paraSemana(s1);
    const periodo2 = this.paraSemana(s2);
    return {
      unidade: unidades[0] ?? null,
      modo: 'semanas',
      periodos: [periodo1, periodo2],
      periodo1,
      periodo2,
      agregacao: null,
      filtrosAplicados: this.filtros(
        dimensao,
        unidades,
        funcionarioIds,
        metrica,
        base,
        'comparar',
      ),
      crescimento: this.ordenarCrescimento(vendas),
      queda: this.ordenarQueda(vendas),
      maioresVendas: [],
      maioresRejeitados: this.ordenarDeltaDesc(rejeitados),
    };
  }

  private async evolucaoSemanas(
    unidades: Unidade[],
    semanas: SemanaAnalise[],
    dimensao: ComercialAnaliseDimensao,
    funcionarioIds: string[] | undefined,
    metrica: ComercialAnaliseMetrica,
    base: ComercialAnaliseBase,
  ): Promise<ComercialAnaliseResponseDto> {
    const recortes: Recorte[] = [
      ...semanas.map((s) => this.recorteSemana(s)),
      {
        inicio: semanas[0].inicio,
        fimRecebido: semanas[semanas.length - 1].fim,
        fimRejeitado: semanas[semanas.length - 1].fimRejeitado,
      },
    ];
    const carregados = await this.carregarVarios(
      unidades,
      recortes,
      dimensao,
      funcionarioIds,
    );
    const envelope = carregados[carregados.length - 1];
    const mapas = carregados.slice(0, -1);
    const ids = this.idsDe(envelope, ...mapas);
    const vendas = ids.map((id) =>
      this.linhaSerieComEnvelope(id, mapas, envelope, base, metrica),
    );
    const rejeitados = ids.map((id) =>
      this.linhaSerieComEnvelope(id, mapas, envelope, 'rejeitado', metrica),
    );
    return {
      unidade: unidades[0] ?? null,
      modo: 'semanas',
      periodos: semanas.map((s) => this.paraSemana(s)),
      periodo1: null,
      periodo2: null,
      agregacao: 'soma',
      filtrosAplicados: this.filtros(
        dimensao,
        unidades,
        funcionarioIds,
        metrica,
        base,
        'evolucao',
      ),
      crescimento: [],
      queda: [],
      maioresVendas: this.ordenarPeriodo(vendas),
      maioresRejeitados: this.ordenarPeriodo(rejeitados),
    };
  }

  /**
   * Vários recortes: reutiliza cadastro/política por unidade (1×) e busca
   * movimentos em paralelo — evita N× a mesma base estática na análise.
   */
  private async carregarVarios(
    unidades: Unidade[],
    recortes: Recorte[],
    dimensao: ComercialAnaliseDimensao,
    funcionarioIds?: string[],
  ): Promise<MapaItens[]> {
    if (!recortes.length) return [];

    if (dimensao === 'unidade') {
      if (!unidades.length) {
        return recortes.map(() => new Map());
      }
      const porUnidade = await Promise.all(
        unidades.map((u) =>
          this.acompanhamento.obterItensTotalLojaEmRecortes(u, recortes),
        ),
      );
      return recortes.map((_, idxRecorte) => {
        const mapa: MapaItens = new Map();
        unidades.forEach((u, idxUnidade) => {
          mapa.set(u, porUnidade[idxUnidade][idxRecorte]);
        });
        return mapa;
      });
    }

    const unidade = unidades[0];
    if (!unidade) {
      return recortes.map(() => new Map());
    }
    if (funcionarioIds && funcionarioIds.length === 0) {
      return recortes.map(() => new Map());
    }
    const filtro =
      funcionarioIds == null ? null : new Set(funcionarioIds);
    const porRecorte =
      await this.acompanhamento.listarItensVendedoresEmRecortes(
        unidade,
        recortes,
      );
    return porRecorte.map((itens) => {
      const mapa: MapaItens = new Map();
      for (const item of itens) {
        if (!item.funcionarioId) continue;
        if (filtro && !filtro.has(item.funcionarioId)) continue;
        mapa.set(item.funcionarioId, item);
      }
      return mapa;
    });
  }

  private recorteMes(periodo: PeriodoAnalise): Recorte {
    return {
      inicio: periodo.inicio,
      fimRecebido: periodo.fim,
      fimRejeitado: periodo.fim,
    };
  }

  private recorteSemana(semana: SemanaAnalise): Recorte {
    return {
      inicio: semana.inicio,
      fimRecebido: semana.fim,
      fimRejeitado: semana.fimRejeitado,
    };
  }

  private linhaComparar(
    id: string,
    mapa1: MapaItens,
    mapa2: MapaItens,
    base: ComercialAnaliseBase | 'rejeitado',
    metrica: ComercialAnaliseMetrica,
  ): ComercialAnaliseLinhaDto {
    const a = mapa1.get(id) ?? mapa2.get(id);
    const p1 = this.par(mapa1.get(id), base);
    const p2 = this.par(mapa2.get(id), base);
    const m1 = this.metricaDe(p1, metrica);
    const m2 = this.metricaDe(p2, metrica);
    const delta = (m2 ?? 0) - (m1 ?? 0);
    return {
      ...this.identidade(a!, id),
      valorMes1: m1,
      valorMes2: m2,
      valorPeriodo: null,
      valorMedia: null,
      delta,
      percentual: m1 != null && m1 !== 0 ? (delta / m1) * 100 : null,
    };
  }

  private linhaSerie(
    id: string,
    mapas: MapaItens[],
    base: ComercialAnaliseBase | 'rejeitado',
    metrica: ComercialAnaliseMetrica,
    comMedia: boolean,
  ): ComercialAnaliseLinhaDto {
    const item = mapas.map((m) => m.get(id)).find((i) => i != null);
    const pares = mapas.map((m) => this.par(m.get(id), base));
    return this.montarSerie(item!, id, pares, metrica, comMedia);
  }

  private linhaSerieComEnvelope(
    id: string,
    mapas: MapaItens[],
    envelope: MapaItens,
    base: ComercialAnaliseBase | 'rejeitado',
    metrica: ComercialAnaliseMetrica,
  ): ComercialAnaliseLinhaDto {
    const item =
      envelope.get(id) ?? mapas.map((m) => m.get(id)).find((i) => i != null);
    const pares = mapas.map((m) => this.par(m.get(id), base));
    const linha = this.montarSerie(item!, id, pares, metrica, false);
    const total = this.metricaDe(this.par(envelope.get(id), base), metrica);
    linha.valorPeriodo = total;
    return linha;
  }

  private montarSerie(
    item: ComercialAcompanhamentoItemDto,
    id: string,
    pares: Par[],
    metrica: ComercialAnaliseMetrica,
    comMedia: boolean,
  ): ComercialAnaliseLinhaDto {
    const soma: Par = pares.reduce(
      (acc, p) => ({ valor: acc.valor + p.valor, qtd: acc.qtd + p.qtd }),
      { valor: 0, qtd: 0 },
    );
    const valorPeriodo = this.metricaDe(soma, metrica);
    const n = pares.length;
    return {
      ...this.identidade(item, id),
      valorMes1: null,
      valorMes2: null,
      valorPeriodo,
      valorMedia:
        !comMedia || metrica === 'ticketMedio' || valorPeriodo == null || n <= 0
          ? null
          : metrica === 'valor'
            ? this.round2(valorPeriodo / n)
            : valorPeriodo / n,
      serie: pares.map((p) => this.metricaDe(p, metrica)),
      delta: 0,
      percentual: null,
    };
  }

  private par(
    item: ComercialAcompanhamentoItemDto | undefined,
    base: ComercialAnaliseBase | 'rejeitado',
  ): Par {
    if (!item) return { valor: 0, qtd: 0 };
    if (base === 'rejeitado') {
      return { valor: item.valorRejeitado, qtd: item.quantidadeRejeitado };
    }
    // Manipulado — mesmas 4 parcelas do RESULTADOS do card.
    if (base === 'manipuladosRequisicoes') {
      return {
        valor: item.valorRequisicaoPura,
        qtd: item.quantidadeRecebidoRequisicao,
      };
    }
    if (base === 'manipuladosSetor') {
      return {
        valor: item.valorRevendaManipulados,
        qtd: item.quantidadeRevendaManipulados,
      };
    }
    if (base === 'manipuladosTerceiros') {
      return {
        valor: item.valorTerceirosManipulados,
        qtd: item.quantidadeTerceirosManipulados,
      };
    }
    if (base === 'manipulados') {
      return {
        valor: item.valorRecebidoRequisicao,
        qtd: item.quantidadeRecebidoRequisicao,
      };
    }
    // Marca própria — mesmas 3 parcelas do RESULTADOS do card.
    if (base === 'marcaPropriaSetores') {
      return {
        valor: item.valorRecebidoMarcaPropriaSetores ?? 0,
        qtd: item.quantidadeRecebidoMarcaPropriaSetores ?? 0,
      };
    }
    if (base === 'marcaPropriaOutros') {
      return {
        valor: item.valorRecebidoMarcaPropriaOutros ?? 0,
        qtd: item.quantidadeRecebidoMarcaPropriaOutros ?? 0,
      };
    }
    if (base === 'marcaPropria') {
      return {
        valor: item.valorRecebidoMarcaPropria,
        qtd: item.quantidadeRecebidoMarcaPropria,
      };
    }
    // totalVendido = Manipulado (total) + Marca própria (total).
    return {
      valor: this.round2(
        item.valorRecebidoRequisicao + item.valorRecebidoMarcaPropria,
      ),
      qtd:
        item.quantidadeRecebidoRequisicao + item.quantidadeRecebidoMarcaPropria,
    };
  }

  private metricaDe(par: Par, metrica: ComercialAnaliseMetrica): number | null {
    if (metrica === 'quantidade') return par.qtd;
    if (metrica === 'ticketMedio') {
      return par.qtd > 0 ? this.round2(par.valor / par.qtd) : null;
    }
    return this.round2(par.valor);
  }

  private identidade(
    item: ComercialAcompanhamentoItemDto,
    idLinha: string,
  ): Pick<
    ComercialAnaliseLinhaDto,
    'funcionarioId' | 'nomeVendedor' | 'codigoVendedorErp'
  > {
    return {
      // Em dimensao=unidade o id da linha é a própria Unidade (TOTAL sem funcionarioId).
      funcionarioId: item.funcionarioId ?? idLinha,
      nomeVendedor: item.nomeVendedor,
      codigoVendedorErp: item.codigoVendedorErp ?? 0,
    };
  }

  private destaqueDeLinha(
    linha: ComercialAnaliseLinhaDto | null,
  ): ComercialAnaliseHomeDestaqueDto | null {
    if (!linha) return null;
    return {
      funcionarioId: linha.funcionarioId,
      nomeVendedor: linha.nomeVendedor,
      delta: linha.delta,
      percentual: linha.percentual,
      valorSemanaAtual: linha.valorMes2 ?? 0,
    };
  }

  /** Maior valor rejeitado na semana atual (não usa Δ). */
  private destaqueRejeitadoSemana(
    mapaSemanaAtual: MapaItens,
  ): ComercialAnaliseHomeRejeitadoDto | null {
    let melhor: ComercialAnaliseHomeRejeitadoDto | null = null;
    for (const [id, item] of mapaSemanaAtual) {
      const valor = this.round2(item.valorRejeitado ?? 0);
      if (valor <= 0) continue;
      if (
        !melhor ||
        valor > melhor.valor ||
        (valor === melhor.valor &&
          item.nomeVendedor.localeCompare(melhor.nomeVendedor, 'pt-BR') < 0)
      ) {
        melhor = {
          funcionarioId: item.funcionarioId ?? id,
          nomeVendedor: item.nomeVendedor,
          valor,
        };
      }
    }
    return melhor;
  }

  private ordenarCrescimento(
    linhas: ComercialAnaliseLinhaDto[],
  ): ComercialAnaliseLinhaDto[] {
    return linhas
      .filter((l) => l.delta >= 0)
      .sort((a, b) => b.delta - a.delta || this.porNome(a, b));
  }

  private ordenarQueda(
    linhas: ComercialAnaliseLinhaDto[],
  ): ComercialAnaliseLinhaDto[] {
    return linhas
      .filter((l) => l.delta < 0)
      .sort((a, b) => a.delta - b.delta || this.porNome(a, b));
  }

  private ordenarDeltaDesc(
    linhas: ComercialAnaliseLinhaDto[],
  ): ComercialAnaliseLinhaDto[] {
    return [...linhas].sort(
      (a, b) =>
        b.delta - a.delta ||
        (b.valorMes2 ?? 0) - (a.valorMes2 ?? 0) ||
        this.porNome(a, b),
    );
  }

  private ordenarPeriodo(
    linhas: ComercialAnaliseLinhaDto[],
  ): ComercialAnaliseLinhaDto[] {
    return [...linhas].sort(
      (a, b) =>
        (b.valorPeriodo ?? Number.NEGATIVE_INFINITY) -
          (a.valorPeriodo ?? Number.NEGATIVE_INFINITY) || this.porNome(a, b),
    );
  }

  private porNome(
    a: ComercialAnaliseLinhaDto,
    b: ComercialAnaliseLinhaDto,
  ): number {
    return a.nomeVendedor.localeCompare(b.nomeVendedor, 'pt-BR');
  }

  private idsDe(...mapas: MapaItens[]): string[] {
    const ids = new Set<string>();
    for (const mapa of mapas) {
      for (const id of mapa.keys()) ids.add(id);
    }
    return [...ids];
  }

  private exigirCompetencia(
    key: string | undefined,
    hoje: string,
    campo: string,
  ): PeriodoAnalise {
    const parsed = parseCompetenciaKey(key);
    if (!parsed) {
      throw new BadRequestException(
        `Informe ${campo} no formato YYYY-MM.`,
      );
    }
    const encontrada = listarCompetenciasAnalise(hoje).find(
      (c) => c.key === parsed.key,
    );
    if (!encontrada) {
      throw new BadRequestException(
        `Competência ${parsed.key} não entra na análise (mês futuro ou anterior a ${COMERCIAL_ANALISE_ANO_MIN}).`,
      );
    }
    return encontrada;
  }

  /**
   * Competência das semanas em /opcoes: filtro válido na lista com movimento,
   * senão a última com movimento (ex.: out/2026 se nov estiver zerado).
   */
  private resolverCompetenciaSemanas(
    keysComMovimento: string[],
    filtro?: string,
  ): string | null {
    if (!keysComMovimento.length) return null;
    if (filtro) {
      const parsed = parseCompetenciaKey(filtro);
      if (parsed && keysComMovimento.includes(parsed.key)) {
        return parsed.key;
      }
    }
    return keysComMovimento[keysComMovimento.length - 1] ?? null;
  }

  /** Competência do modo semanas na análise (omite = última com movimento). */
  private async resolverCompetenciaSemanasAnalise(
    unidades: Unidade[],
    hoje: string,
    competencia?: string,
  ): Promise<string> {
    const calendario = listarCompetenciasAnalise(hoje);
    if (competencia) {
      return this.exigirCompetencia(competencia, hoje, 'competencia').key;
    }
    if (!unidades.length) {
      return `${hoje.slice(0, 4)}-${hoje.slice(5, 7)}`;
    }
    const comMovimento = await this.acompanhamento.listarAnoMesComMovimento(
      unidades,
      calendario[0]?.inicio ?? `${COMERCIAL_ANALISE_ANO_MIN}-01-01`,
      hoje,
    );
    const keys = calendario
      .filter((c) => comMovimento.has(c.key))
      .map((c) => c.key);
    if (keys.length) return keys[keys.length - 1];
    return `${hoje.slice(0, 4)}-${hoje.slice(5, 7)}`;
  }

  private resolverSemana(
    semanas: SemanaAnalise[],
    key: string | undefined,
    indicePadraoAPartirDoFim: number,
  ): SemanaAnalise | null {
    if (key) {
      const encontrada = semanas.find((s) => s.key === key);
      if (!encontrada) {
        throw new BadRequestException(
          'Semana fora da competência selecionada. Atualize as opções e escolha de novo.',
        );
      }
      return encontrada;
    }
    const indice = semanas.length - 1 - indicePadraoAPartirDoFim;
    return indice >= 0 ? semanas[indice] : null;
  }

  private filtros(
    dimensao: ComercialAnaliseDimensao,
    unidades: Unidade[],
    funcionarioIds: string[] | undefined,
    metrica: ComercialAnaliseMetrica,
    base: ComercialAnaliseBase,
    leitura: ComercialAnaliseLeitura | null,
  ): ComercialAnaliseFiltrosAplicadosDto {
    return {
      dimensao,
      unidades,
      funcionarioIds: dimensao === 'unidade' ? [] : (funcionarioIds ?? []),
      metrica,
      base,
      leitura,
    };
  }

  private paraPeriodo(periodo: PeriodoAnalise): ComercialAnalisePeriodoDto {
    return {
      key: periodo.key,
      label: periodo.label,
      labelCurto: periodo.labelCurto,
      previa: periodo.previa,
      inicio: periodo.inicio,
      fim: periodo.fim,
    };
  }

  private paraSemana(semana: SemanaAnalise): ComercialAnalisePeriodoDto {
    return {
      key: semana.key,
      label: semana.label,
      labelCurto: semana.labelCurto,
      previa: semana.previa,
      inicio: semana.inicio,
      fim: semana.fim,
    };
  }

  /** Unidades que o usuário pode analisar (escopo fixo ou enum completo). */
  private unidadesDoEscopo(usuario: Usuario): Unidade[] {
    const escopo = unidadeEscopoUsuarioFolha(usuario);
    return escopo ? [escopo] : (Object.values(Unidade) as Unidade[]);
  }

  /**
   * vendedor → exatamente 1 unidade (escopo ou `unidade`).
   * unidade → lista marcada (`unidades`); omitido = todas do escopo; [] = nenhuma.
   */
  private resolverUnidadesAnalise(
    usuario: Usuario,
    dto: FindComercialAnaliseDto,
    dimensao: ComercialAnaliseDimensao,
  ): Unidade[] {
    const permitidas = this.unidadesDoEscopo(usuario);
    const escopo = unidadeEscopoUsuarioFolha(usuario);

    if (dimensao === 'vendedor') {
      const efetiva = escopo ?? dto.unidade;
      if (!efetiva) {
        throw new BadRequestException(
          'Informe a unidade para a análise por vendedor.',
        );
      }
      assertUnidadeFolha(usuario, efetiva);
      return [efetiva];
    }

    // dimensao=unidade
    if (escopo) {
      return [escopo];
    }
    if (dto.unidades === undefined) {
      // Compat: `unidade` singular ainda vale como única marcada.
      if (dto.unidade) {
        assertUnidadeFolha(usuario, dto.unidade);
        return [dto.unidade];
      }
      return [...permitidas];
    }
    const setPermitidas = new Set(permitidas);
    return dto.unidades.filter((u) => setPermitidas.has(u));
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
