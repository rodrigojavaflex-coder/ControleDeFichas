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
  assertUnidadeProducao,
  unidadeEscopoUsuarioProducao,
} from '../folha/utils/folha-unidade-scope.util';
import { getUsuarioPermissoes } from '../../common/utils/usuario-permissoes.util';
import {
  ProdutividadeAnaliticoLinhaDto,
  ProdutividadeAnaliticoResponseDto,
} from './dto/produtividade-analitico-response.dto';
import {
  ProdutividadeConsultaResponseDto,
  ProdutividadeFuncionarioRowDto,
  ProdutividadeFuncionarioSemCadastroDto,
  ProdutividadeFuncionarioSemEtapaVinculadaDto,
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
    const unidades = this.resolverUnidadesConsulta(
      usuario,
      unidadesQuery,
      unidadeLegado,
    );

    if (dataInicio > dataFim) {
      throw new BadRequestException(
        'dataInicio não pode ser posterior a dataFim.',
      );
    }

    return this.consultarConsolidado(usuario, unidades, dataInicio, dataFim);
  }

  async consultarAnalitico(
    usuario: Usuario,
    unidadesQuery: Unidade[] | undefined,
    dataInicio: string,
    dataFim: string,
    unidadeLegado?: Unidade,
  ): Promise<ProdutividadeAnaliticoResponseDto> {
    const unidades = this.resolverUnidadesConsulta(
      usuario,
      unidadesQuery,
      unidadeLegado,
    );

    if (dataInicio > dataFim) {
      throw new BadRequestException(
        'dataInicio não pode ser posterior a dataFim.',
      );
    }

    return this.consultarAnaliticoLinhas(usuario, unidades, dataInicio, dataFim);
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

    const escopo = unidadeEscopoUsuarioProducao(usuario);
    if (escopo) {
      return [escopo];
    }

    if (solicitadas.length === 0) {
      throw new BadRequestException('Informe ao menos uma unidade.');
    }

    const unicas = [...new Set(solicitadas)];
    for (const unidade of unicas) {
      assertUnidadeProducao(usuario, unidade);
    }
    return unicas;
  }

  /**
   * Contabilização consolidada: resumo de cada unidade selecionada pode ser atribuído
   * a funcionário cadastrado em **qualquer** unidade do escopo (mesmo `codigoFuncionarioErp`).
   * Remuneração usa valores da unidade **da linha do resumo**; etapas do funcionário usam
   * o cadastro onde ele está configurado.
   */
  private async consultarConsolidado(
    usuario: Usuario,
    unidades: Unidade[],
    dataInicio: string,
    dataFim: string,
  ): Promise<ProdutividadeConsultaResponseDto> {
    for (const unidade of unidades) {
      assertUnidadeProducao(usuario, unidade);
    }

    const remuneradas = await this.etapaRemuneracaoRepo.find({
      where: { unidade: In(unidades), recebe: true },
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
      .where('f.unidade IN (:...unidades)', { unidades })
      .andWhere('f.codigoFuncionarioErp IS NOT NULL')
      .getMany();

    const funcionariosPorCodErp = new Map<number, Funcionario[]>();
    for (const funcionario of funcionarios) {
      if (funcionario.codigoFuncionarioErp == null) continue;
      const cod = funcionario.codigoFuncionarioErp;
      const lista = funcionariosPorCodErp.get(cod) ?? [];
      lista.push(funcionario);
      funcionariosPorCodErp.set(cod, lista);
    }

    const funcEtapas = await this.funcionarioEtapaRepo.find({
      where: { unidade: In(unidades), recebe: true },
      relations: ['funcionario'],
    });
    const funcEtapaSet = new Set(
      funcEtapas
        .filter((fe) => fe.funcionario?.id)
        .map((fe) => `${fe.funcionario.id}:${fe.codEtapa}`),
    );

    const linhasResumo = await this.resumoRepo
      .createQueryBuilder('r')
      .where('r.unidade IN (:...unidades)', { unidades })
      .andWhere('r.dataSaida >= :dataInicio', { dataInicio })
      .andWhere('r.dataSaida <= :dataFim', { dataFim })
      .andWhere('r.codFuncSaida IS NOT NULL')
      .getMany();

    const aggPorCodErp = new Map<number, AccFuncionarioConsolidado>();
    const semCadastroPorCodErp = new Map<number, AccSemCadastro>();
    const semEtapaVinculadaPorCodErp = new Map<number, AccSemEtapaVinculada>();
    let linhasContabilizadas = 0;
    let linhasSemFuncionario = 0;
    let linhasEtapaNaoConfigurada = 0;

    for (const row of linhasResumo) {
      const codFunc = row.codFuncSaida;
      if (codFunc == null) continue;

      const funcionario = this.resolverFuncionarioPorCodErp(
        codFunc,
        row.unidade,
        funcionariosPorCodErp,
      );
      if (!funcionario) {
        linhasSemFuncionario += 1;
        this.registrarSemCadastro(semCadastroPorCodErp, codFunc, row);
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

      linhasContabilizadas += 1;

      const chaveAgg = funcionario.codigoFuncionarioErp as number;
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
        acc.codigosErp.add(c.codigoFuncionarioErp as number);
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

    const funcionariosRows: ProdutividadeFuncionarioRowDto[] = [];

    for (const acc of aggPorCodErp.values()) {
      const etapas = [...acc.etapas.values()]
        .map((e) => ({
          codEtapa: e.codEtapa,
          etapa: e.etapa,
          quantidade: e.quantidade,
          valorUnitario:
            e.quantidade > 0 ? e.valorTotal / e.quantidade : 0,
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
        codigoFuncionarioErp: codigos[0],
        codigosFuncionarioErp: codigos.length > 1 ? codigos : undefined,
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
    const avisos = this.montarAvisos(
      semCadastroPorCodErp,
      semEtapaVinculadaPorCodErp,
      linhasSemFuncionario,
    );

    return {
      unidades,
      dataInicio,
      dataFim,
      resumo: {
        linhasResumo: linhasResumo.length,
        linhasContabilizadas,
        linhasSemFuncionario,
        linhasEtapaNaoConfigurada,
        totalQuantidade,
        totalValor,
        totalFuncionarios: funcionariosRows.length,
      },
      avisos,
      funcionarios: funcionariosRows,
    };
  }

  private async consultarAnaliticoLinhas(
    usuario: Usuario,
    unidades: Unidade[],
    dataInicio: string,
    dataFim: string,
  ): Promise<ProdutividadeAnaliticoResponseDto> {
    for (const unidade of unidades) {
      assertUnidadeProducao(usuario, unidade);
    }

    const remuneradas = await this.etapaRemuneracaoRepo.find({
      where: { unidade: In(unidades), recebe: true },
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
      .where('f.unidade IN (:...unidades)', { unidades })
      .andWhere('f.codigoFuncionarioErp IS NOT NULL')
      .getMany();

    const funcionariosPorCodErp = new Map<number, Funcionario[]>();
    for (const funcionario of funcionarios) {
      if (funcionario.codigoFuncionarioErp == null) continue;
      const cod = funcionario.codigoFuncionarioErp;
      const lista = funcionariosPorCodErp.get(cod) ?? [];
      lista.push(funcionario);
      funcionariosPorCodErp.set(cod, lista);
    }

    const funcEtapas = await this.funcionarioEtapaRepo.find({
      where: { unidade: In(unidades), recebe: true },
      relations: ['funcionario'],
    });
    const funcEtapaSet = new Set(
      funcEtapas
        .filter((fe) => fe.funcionario?.id)
        .map((fe) => `${fe.funcionario.id}:${fe.codEtapa}`),
    );

    const linhasResumo = await this.resumoRepo
      .createQueryBuilder('r')
      .where('r.unidade IN (:...unidades)', { unidades })
      .andWhere('r.dataSaida >= :dataInicio', { dataInicio })
      .andWhere('r.dataSaida <= :dataFim', { dataFim })
      .andWhere('r.codFuncSaida IS NOT NULL')
      .getMany();

    const linhas: ProdutividadeAnaliticoLinhaDto[] = [];

    for (const row of linhasResumo) {
      const codFunc = row.codFuncSaida;
      if (codFunc == null) continue;

      const funcionario = this.resolverFuncionarioPorCodErp(
        codFunc,
        row.unidade,
        funcionariosPorCodErp,
      );
      if (!funcionario) continue;

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
      unidades,
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
        totalLinhas: 0,
      };
      mapa.set(codigoErp, acc);
    }
    acc.totalLinhas += 1;
    acc.unidades.set(row.unidade, (acc.unidades.get(row.unidade) ?? 0) + 1);
    const nomeResumo = row.funcSaida?.trim();
    if (nomeResumo) {
      acc.nomes.set(nomeResumo, (acc.nomes.get(nomeResumo) ?? 0) + 1);
    }
  }

  private registrarSemEtapaVinculada(
    mapa: Map<number, AccSemEtapaVinculada>,
    funcionario: Funcionario,
    row: ProducaoEtapaResumo,
    nomeEtapa: string,
  ): void {
    const codigoErp = funcionario.codigoFuncionarioErp as number;
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
      nome: this.nomeMaisFrequente(acc.nomes),
      unidades: [...acc.unidades.entries()]
        .map(([unidade, linhas]) => ({ unidade, linhas }))
        .sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR')),
      totalLinhas: acc.totalLinhas,
    };
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
   * Preferência: cadastro na mesma unidade da linha; senão qualquer unidade do escopo
   * (ex.: funcionário só em INHUMAS contabiliza saída registrada em NERÓPOLIS).
   */
  private resolverFuncionarioPorCodErp(
    codFuncSaida: number,
    unidadeResumo: Unidade,
    funcionariosPorCodErp: Map<number, Funcionario[]>,
  ): Funcionario | undefined {
    const candidatos = funcionariosPorCodErp.get(codFuncSaida);
    if (!candidatos?.length) return undefined;
    return (
      candidatos.find((f) => f.unidade === unidadeResumo) ?? candidatos[0]
    );
  }
}
