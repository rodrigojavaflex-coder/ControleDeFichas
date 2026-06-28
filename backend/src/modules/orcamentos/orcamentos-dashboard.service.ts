import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Orcamento } from './entities/orcamento.entity';
import { FindOrcamentosDashboardDto } from './dto/find-orcamentos-dashboard.dto';
import {
  DashboardAnalisePerdasDto,
  DashboardPerformanceUnidadeDto,
  DashboardEvolucaoTemporalDto,
  DashboardPerformanceMedicoDto,
  DashboardKpisDto,
  DashboardPerformanceVendedorDto,
  OrcamentosDashboardIndicadoresDto,
  OrcamentosDashboardOpcoesFiltroDto,
} from './dto/orcamentos-dashboard-response.dto';
import { OrcamentoStatus } from '../../common/enums/orcamento-status.enum';
import { Unidade } from '../../common/enums/unidade.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  unidadeEscopoUsuarioFolha,
} from '../folha/utils/folha-unidade-scope.util';
import {
  getUsuarioPermissoes,
  usuarioTemAdminFull,
} from '../../common/utils/usuario-permissoes.util';
import { Permission } from '../../common/enums/permission.enum';

/** Classificação operacional para rejeitados sem motivo cadastrado (RN-ORC-002). */
export const SEM_MOTIVO_CLASSIFICACAO = 'Sem motivo';
const LIMITE_PERFORMANCE_MEDICO = 20;
const LIMITE_OPCOES_FILTRO = 5000;
const LIMITE_PARETO = 20;
const LIMITE_PONTOS_EVOLUCAO_DIA = 90;

interface DashboardFiltrosInternos {
  dataInicial?: string;
  dataFinal?: string;
  unidadesFiltro: Unidade[];
  nomesVendedor: string[];
  nomesMedico: string[];
  status: OrcamentoStatus[];
  granularidadeTemporal: 'dia' | 'mes';
  topVendedores: number;
  escopoUnidade: Unidade | 'ALL';
}

@Injectable()
export class OrcamentosDashboardService {
  private readonly logger = new Logger(OrcamentosDashboardService.name);

  constructor(
    @InjectRepository(Orcamento)
    private readonly orcamentoRepo: Repository<Orcamento>,
  ) {}

  async getIndicadores(
    dto: FindOrcamentosDashboardDto,
    usuario: Usuario,
  ): Promise<OrcamentosDashboardIndicadoresDto> {
    const inicio = Date.now();
    const filtros = this.resolverFiltros(dto, usuario);
    const visualizarValores = this.usuarioPodeVisualizarValores(usuario);

    const [
      kpis,
      evolucaoTemporal,
      performanceVendedor,
      performanceUnidade,
      performanceMedico,
      analisePerdas,
    ] = await Promise.all([
      this.buscarKpis(filtros),
      this.buscarEvolucaoTemporal(filtros),
      this.buscarPerformanceVendedor(filtros),
      this.buscarPerformanceUnidade(filtros),
      this.buscarPerformanceMedico(filtros),
      this.buscarAnalisePerdas(filtros),
    ]);

    this.logger.log(
      `Dashboard orçamentos gerado em ${Date.now() - inicio}ms — escopo=${filtros.escopoUnidade}`,
    );

    return {
      filtrosAplicados: {
        dataInicial: filtros.dataInicial ?? null,
        dataFinal: filtros.dataFinal ?? null,
        unidades: filtros.unidadesFiltro,
        nomesVendedor: filtros.nomesVendedor,
        nomesMedico: filtros.nomesMedico,
        status: filtros.status,
        granularidadeTemporal: filtros.granularidadeTemporal,
        topVendedores: filtros.topVendedores,
        escopoUnidade: filtros.escopoUnidade,
        visualizarValores,
      },
      kpis: visualizarValores ? kpis : this.mascararKpis(kpis),
      evolucaoTemporal,
      performanceVendedor: visualizarValores
        ? performanceVendedor
        : this.mascararPerformanceVendedor(performanceVendedor),
      performanceUnidade: visualizarValores
        ? performanceUnidade
        : this.mascararPerformanceUnidade(performanceUnidade),
      performanceMedico: visualizarValores
        ? performanceMedico
        : this.mascararPerformanceMedico(performanceMedico),
      analisePerdas: visualizarValores
        ? analisePerdas
        : this.mascararAnalisePerdas(analisePerdas),
      meta: {
        campoValor: visualizarValores ? 'precoVenda' : 'oculto',
        campoData: 'dataOrcamento',
        geradoEm: new Date().toISOString(),
      },
    };
  }

  async getOpcoesFiltro(
    dto: FindOrcamentosDashboardDto,
    usuario: Usuario,
  ): Promise<OrcamentosDashboardOpcoesFiltroDto> {
    const filtros = this.resolverFiltros(
      { ...dto, nomesVendedor: [], nomesMedico: [], status: undefined },
      usuario,
    );

    const qbVendedor = this.orcamentoRepo
      .createQueryBuilder('o')
      .select(`DISTINCT CONCAT(TRIM(o.nomeVendedor), ' - ', o.unidade)`, 'nome')
      .where('o.nomeVendedor IS NOT NULL')
      .andWhere("TRIM(o.nomeVendedor) <> ''")
      .orderBy('nome', 'ASC')
      .limit(LIMITE_OPCOES_FILTRO);
    this.aplicarFiltrosComuns(qbVendedor, filtros, false);

    const labelMedico = `CONCAT(TRIM(o.nomeMedico), ' - ', o.unidade)`;

    const qbMedico = this.orcamentoRepo
      .createQueryBuilder('o')
      .select(labelMedico, 'nome')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN o.status = :aprovado THEN 1 ELSE 0 END)`,
        'aprovados',
      )
      .addSelect(
        `SUM(CASE WHEN o.status = :rejeitado THEN 1 ELSE 0 END)`,
        'rejeitados',
      )
      .where('o.nomeMedico IS NOT NULL')
      .andWhere("TRIM(o.nomeMedico) <> ''")
      .setParameter('aprovado', OrcamentoStatus.APROVADO)
      .setParameter('rejeitado', OrcamentoStatus.REJEITADO)
      .groupBy(labelMedico)
      .orderBy('nome', 'ASC')
      .limit(LIMITE_OPCOES_FILTRO);
    this.aplicarFiltrosComuns(qbMedico, filtros, false);

    const [vendedores, medicos] = await Promise.all([
      qbVendedor.getRawMany<{ nome: string }>(),
      qbMedico.getRawMany<{
        nome: string;
        total: string;
        aprovados: string;
        rejeitados: string;
      }>(),
    ]);

    return {
      nomesVendedor: vendedores.map((r) => r.nome),
      medicos: medicos.map((r) => ({
        nome: r.nome,
        total: Number(r.total) || 0,
        aprovados: Number(r.aprovados) || 0,
        rejeitados: Number(r.rejeitados) || 0,
      })),
    };
  }

  private resolverFiltros(
    dto: FindOrcamentosDashboardDto,
    usuario: Usuario,
  ): DashboardFiltrosInternos {
    const escopoFixo = this.resolverEscopoFixo(usuario);
    const status =
      dto.status?.length && dto.status.length > 0
        ? dto.status
        : [OrcamentoStatus.APROVADO, OrcamentoStatus.REJEITADO];

    let unidadesFiltro: Unidade[] = dto.unidades ?? [];
    if (escopoFixo !== 'ALL') {
      unidadesFiltro = [escopoFixo];
    }

    return {
      dataInicial: dto.dataInicial,
      dataFinal: dto.dataFinal,
      unidadesFiltro,
      nomesVendedor: dto.nomesVendedor ?? [],
      nomesMedico: dto.nomesMedico ?? [],
      status,
      granularidadeTemporal: dto.granularidadeTemporal ?? 'mes',
      topVendedores: dto.topVendedores ?? 10,
      escopoUnidade: escopoFixo,
    };
  }

  private resolverEscopoFixo(usuario: Usuario): Unidade | 'ALL' {
    if (usuarioTemAdminFull(usuario)) {
      return 'ALL';
    }
    const escopo = unidadeEscopoUsuarioFolha(usuario);
    return escopo ?? 'ALL';
  }

  private usuarioPodeVisualizarValores(usuario: Usuario): boolean {
    if (usuarioTemAdminFull(usuario)) {
      return true;
    }
    return getUsuarioPermissoes(usuario).includes(
      Permission.ORCAMENTO_DASHBOARD_VIEW_VALORES,
    );
  }

  private mascararKpis(kpis: DashboardKpisDto): DashboardKpisDto {
    return {
      ...kpis,
      volumeTotal: { ...kpis.volumeTotal, valor: 0 },
      receitaAprovada: { ...kpis.receitaAprovada, valor: 0 },
      valorPerdido: { ...kpis.valorPerdido, valor: 0 },
    };
  }

  private mascararPerformanceVendedor(
    performance: DashboardPerformanceVendedorDto,
  ): DashboardPerformanceVendedorDto {
    return {
      ...performance,
      detalhes: performance.detalhes.map((item) => ({
        ...item,
        valorAprovado: 0,
      })),
    };
  }

  private mascararPerformanceUnidade(
    performance: DashboardPerformanceUnidadeDto,
  ): DashboardPerformanceUnidadeDto {
    return {
      ...performance,
      detalhes: performance.detalhes.map((item) => ({
        ...item,
        valorAprovado: 0,
      })),
    };
  }

  private mascararPerformanceMedico(
    performance: DashboardPerformanceMedicoDto,
  ): DashboardPerformanceMedicoDto {
    return {
      ...performance,
      detalhes: performance.detalhes.map((item) => ({
        ...item,
        valorAprovado: 0,
      })),
    };
  }

  private mascararAnalisePerdas(
    perdas: DashboardAnalisePerdasDto,
  ): DashboardAnalisePerdasDto {
    return {
      ...perdas,
      series: perdas.series.map((serie) =>
        serie.name === 'Valor perdido'
          ? { ...serie, data: serie.data.map(() => 0) }
          : serie,
      ),
      pareto: perdas.pareto.map((item) => ({
        ...item,
        valorPerdido: 0,
      })),
    };
  }

  private aplicarFiltrosComuns(
    qb: SelectQueryBuilder<Orcamento>,
    filtros: DashboardFiltrosInternos,
    aplicarDimensoes = true,
    alias = 'o',
  ): void {
    if (filtros.escopoUnidade !== 'ALL') {
      qb.andWhere(`${alias}.unidade = :escopoUnidade`, {
        escopoUnidade: filtros.escopoUnidade,
      });
    } else if (filtros.unidadesFiltro.length > 0) {
      qb.andWhere(`${alias}.unidade IN (:...unidadesFiltro)`, {
        unidadesFiltro: filtros.unidadesFiltro,
      });
    }

    if (filtros.dataInicial) {
      qb.andWhere(`${alias}.dataOrcamento >= :dataInicial`, {
        dataInicial: filtros.dataInicial,
      });
    }
    if (filtros.dataFinal) {
      qb.andWhere(`${alias}.dataOrcamento <= :dataFinal`, {
        dataFinal: filtros.dataFinal,
      });
    }

    if (!aplicarDimensoes) {
      return;
    }

    if (filtros.nomesVendedor.length > 0) {
      qb.andWhere(
        `CONCAT(COALESCE(NULLIF(TRIM(${alias}.nomeVendedor), ''), 'Sem vendedor'), ' - ', ${alias}.unidade) IN (:...labelsVendedor)`,
        { labelsVendedor: filtros.nomesVendedor },
      );
    }

    if (filtros.nomesMedico.length > 0) {
      qb.andWhere(
        `CONCAT(COALESCE(NULLIF(TRIM(${alias}.nomeMedico), ''), 'Sem médico'), ' - ', ${alias}.unidade) IN (:...labelsMedico)`,
        { labelsMedico: filtros.nomesMedico },
      );
    }

    if (filtros.status.length === 1) {
      qb.andWhere(`${alias}.status = :statusUnico`, {
        statusUnico: filtros.status[0],
      });
    } else if (
      filtros.status.length > 0 &&
      filtros.status.length < 2
    ) {
      qb.andWhere(`${alias}.status IN (:...statusList)`, {
        statusList: filtros.status,
      });
    }
  }

  private async buscarKpis(
    filtros: DashboardFiltrosInternos,
  ): Promise<DashboardKpisDto> {
    const qb = this.orcamentoRepo.createQueryBuilder('o');
    qb.select('COUNT(*)', 'quantidadeTotal')
      .addSelect('COALESCE(SUM(o.precoVenda), 0)', 'valorTotal')
      .addSelect(
        `COUNT(*) FILTER (WHERE o.status = :aprovado)`,
        'quantidadeAprovada',
      )
      .addSelect(
        `COALESCE(SUM(o.precoVenda) FILTER (WHERE o.status = :aprovado), 0)`,
        'receitaAprovada',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE o.status = :rejeitado)`,
        'quantidadeRejeitada',
      )
      .addSelect(
        `COALESCE(SUM(o.precoVenda) FILTER (WHERE o.status = :rejeitado), 0)`,
        'valorPerdido',
      )
      .setParameter('aprovado', OrcamentoStatus.APROVADO)
      .setParameter('rejeitado', OrcamentoStatus.REJEITADO);

    this.aplicarFiltrosComuns(qb, filtros);

    const raw = await qb.getRawOne<{
      quantidadeTotal: string;
      valorTotal: string;
      quantidadeAprovada: string;
      receitaAprovada: string;
      quantidadeRejeitada: string;
      valorPerdido: string;
    }>();

    const quantidadeTotal = this.toInt(raw?.quantidadeTotal);
    const quantidadeAprovada = this.toInt(raw?.quantidadeAprovada);
    const valorTotal = this.toNumber(raw?.valorTotal);
    const receitaAprovada = this.toNumber(raw?.receitaAprovada);
    const valorPerdido = this.toNumber(raw?.valorPerdido);
    const quantidadeRejeitada = this.toInt(raw?.quantidadeRejeitada);

    const taxaConversao =
      quantidadeTotal > 0
        ? this.round2((quantidadeAprovada / quantidadeTotal) * 100)
        : 0;

    return {
      volumeTotal: { quantidade: quantidadeTotal, valor: valorTotal },
      taxaConversao: {
        percentual: taxaConversao,
        quantidadeAprovada,
        quantidadeTotal,
      },
      receitaAprovada: {
        quantidade: quantidadeAprovada,
        valor: receitaAprovada,
      },
      valorPerdido: {
        quantidade: quantidadeRejeitada,
        valor: valorPerdido,
      },
    };
  }

  private async buscarEvolucaoTemporal(
    filtros: DashboardFiltrosInternos,
  ): Promise<DashboardEvolucaoTemporalDto> {
    const trunc =
      filtros.granularidadeTemporal === 'dia'
        ? "TO_CHAR(o.\"dataOrcamento\", 'YYYY-MM-DD')"
        : "TO_CHAR(DATE_TRUNC('month', o.\"dataOrcamento\"), 'YYYY-MM')";

    const qb = this.orcamentoRepo.createQueryBuilder('o');
    qb.select(trunc, 'periodo')
      .addSelect(
        `COALESCE(SUM(o.precoVenda) FILTER (WHERE o.status = :aprovado), 0)`,
        'valorAprovado',
      )
      .addSelect(
        `COALESCE(SUM(o.precoVenda) FILTER (WHERE o.status = :rejeitado), 0)`,
        'valorRejeitado',
      )
      .setParameter('aprovado', OrcamentoStatus.APROVADO)
      .setParameter('rejeitado', OrcamentoStatus.REJEITADO)
      .groupBy('periodo')
      .orderBy('periodo', 'ASC');

    this.aplicarFiltrosComuns(qb, filtros);

    const rows = await qb.getRawMany<{
      periodo: string;
      valorAprovado: string;
      valorRejeitado: string;
    }>();

    const rowsLimitados =
      filtros.granularidadeTemporal === 'dia'
        ? rows.slice(-LIMITE_PONTOS_EVOLUCAO_DIA)
        : rows;

    return {
      granularidade: filtros.granularidadeTemporal,
      labels: rowsLimitados.map((r) => r.periodo),
      series: [
        {
          name: 'Aprovado',
          data: rowsLimitados.map((r) => this.toNumber(r.valorAprovado)),
        },
        {
          name: 'Rejeitado',
          data: rowsLimitados.map((r) => this.toNumber(r.valorRejeitado)),
        },
      ],
    };
  }

  private async buscarPerformanceVendedor(
    filtros: DashboardFiltrosInternos,
  ): Promise<DashboardPerformanceVendedorDto> {
    const labelVendedor = `CONCAT(COALESCE(NULLIF(TRIM(o.nomeVendedor), ''), 'Sem vendedor'), ' - ', o.unidade)`;
    const qb = this.orcamentoRepo.createQueryBuilder('o');
    qb.select(labelVendedor, 'nomeVendedor')
      .addSelect('COUNT(*)', 'quantidadeTotal')
      .addSelect(
        `COUNT(*) FILTER (WHERE o.status = :aprovado)`,
        'quantidadeAprovada',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE o.status = :rejeitado)`,
        'quantidadeRejeitada',
      )
      .addSelect(
        `COALESCE(SUM(o.precoVenda) FILTER (WHERE o.status = :aprovado), 0)`,
        'valorAprovado',
      )
      .setParameter('aprovado', OrcamentoStatus.APROVADO)
      .setParameter('rejeitado', OrcamentoStatus.REJEITADO)
      .groupBy(labelVendedor);

    this.aplicarFiltrosComuns(qb, filtros);

    const rows = await qb.getRawMany<{
      nomeVendedor: string;
      quantidadeTotal: string;
      quantidadeAprovada: string;
      quantidadeRejeitada: string;
      valorAprovado: string;
    }>();

    const detalhes = rows
      .map((r) => {
        const quantidadeTotal = this.toInt(r.quantidadeTotal);
        const quantidadeAprovada = this.toInt(r.quantidadeAprovada);
        const quantidadeRejeitada = this.toInt(r.quantidadeRejeitada);
        const taxaConversao =
          quantidadeTotal > 0
            ? this.round2((quantidadeAprovada / quantidadeTotal) * 100)
            : 0;
        return {
          nomeVendedor: r.nomeVendedor,
          quantidadeTotal,
          quantidadeAprovada,
          quantidadeRejeitada,
          valorAprovado: this.toNumber(r.valorAprovado),
          taxaConversao,
        };
      })
      .sort((a, b) => b.quantidadeTotal - a.quantidadeTotal);

    const detalhesTop = [...detalhes]
      .sort((a, b) => b.quantidadeAprovada - a.quantidadeAprovada)
      .slice(0, filtros.topVendedores);

    return {
      top: filtros.topVendedores,
      labels: detalhesTop.map((d) => d.nomeVendedor ?? 'Sem vendedor'),
      series: [
        {
          name: 'Quantidade aprovada',
          data: detalhesTop.map((d) => d.quantidadeAprovada),
        },
        {
          name: 'Taxa de conversão (%)',
          data: detalhesTop.map((d) => d.taxaConversao),
        },
      ],
      detalhes,
    };
  }

  private async buscarPerformanceUnidade(
    filtros: DashboardFiltrosInternos,
  ): Promise<DashboardPerformanceUnidadeDto> {
    const qb = this.orcamentoRepo.createQueryBuilder('o');
    qb.select('o.unidade', 'unidade')
      .addSelect('COUNT(*)', 'quantidadeTotal')
      .addSelect(
        `COUNT(*) FILTER (WHERE o.status = :aprovado)`,
        'quantidadeAprovada',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE o.status = :rejeitado)`,
        'quantidadeRejeitada',
      )
      .addSelect(
        `COALESCE(SUM(o.precoVenda) FILTER (WHERE o.status = :aprovado), 0)`,
        'valorAprovado',
      )
      .setParameter('aprovado', OrcamentoStatus.APROVADO)
      .setParameter('rejeitado', OrcamentoStatus.REJEITADO)
      .groupBy('o.unidade');

    this.aplicarFiltrosComuns(qb, filtros);

    const rows = await qb.getRawMany<{
      unidade: Unidade;
      quantidadeTotal: string;
      quantidadeAprovada: string;
      quantidadeRejeitada: string;
      valorAprovado: string;
    }>();

    const detalhes = rows
      .map((r) => {
        const quantidadeTotal = this.toInt(r.quantidadeTotal);
        const quantidadeAprovada = this.toInt(r.quantidadeAprovada);
        const quantidadeRejeitada = this.toInt(r.quantidadeRejeitada);
        const taxaConversao =
          quantidadeTotal > 0
            ? this.round2((quantidadeAprovada / quantidadeTotal) * 100)
            : 0;
        return {
          unidade: r.unidade,
          quantidadeTotal,
          quantidadeAprovada,
          quantidadeRejeitada,
          valorAprovado: this.toNumber(r.valorAprovado),
          taxaConversao,
        };
      })
      .sort(
        (a, b) =>
          a.unidade.localeCompare(b.unidade, 'pt-BR') ||
          b.quantidadeTotal - a.quantidadeTotal,
      );

    return {
      labels: detalhes.map((d) => d.unidade),
      series: [
        {
          name: 'Quantidade aprovada',
          data: detalhes.map((d) => d.quantidadeAprovada),
        },
        {
          name: 'Taxa de conversão (%)',
          data: detalhes.map((d) => d.taxaConversao),
        },
      ],
      detalhes,
    };
  }

  private async buscarPerformanceMedico(
    filtros: DashboardFiltrosInternos,
  ): Promise<DashboardPerformanceMedicoDto> {
    const labelMedico = `CONCAT(COALESCE(NULLIF(TRIM(o.nomeMedico), ''), 'Sem médico'), ' - ', o.unidade)`;
    const qb = this.orcamentoRepo.createQueryBuilder('o');
    qb.select(labelMedico, 'nomeMedico')
      .addSelect('COUNT(*)', 'quantidadeTotal')
      .addSelect(
        `COUNT(*) FILTER (WHERE o.status = :aprovado)`,
        'quantidadeAprovada',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE o.status = :rejeitado)`,
        'quantidadeRejeitada',
      )
      .addSelect(
        `COALESCE(SUM(o.precoVenda) FILTER (WHERE o.status = :aprovado), 0)`,
        'valorAprovado',
      )
      .setParameter('aprovado', OrcamentoStatus.APROVADO)
      .setParameter('rejeitado', OrcamentoStatus.REJEITADO)
      .groupBy(labelMedico);

    this.aplicarFiltrosComuns(qb, filtros);

    const rows = await qb.getRawMany<{
      nomeMedico: string;
      quantidadeTotal: string;
      quantidadeAprovada: string;
      quantidadeRejeitada: string;
      valorAprovado: string;
    }>();

    const detalhes = rows
      .map((r) => {
        const quantidadeTotal = this.toInt(r.quantidadeTotal);
        const quantidadeAprovada = this.toInt(r.quantidadeAprovada);
        const quantidadeRejeitada = this.toInt(r.quantidadeRejeitada);
        const taxaConversao =
          quantidadeTotal > 0
            ? this.round2((quantidadeAprovada / quantidadeTotal) * 100)
            : 0;
        return {
          nomeMedico: r.nomeMedico,
          quantidadeTotal,
          quantidadeAprovada,
          quantidadeRejeitada,
          valorAprovado: this.toNumber(r.valorAprovado),
          taxaConversao,
        };
      })
      .sort((a, b) => b.quantidadeTotal - a.quantidadeTotal);

    const detalhesTop = [...detalhes]
      .sort((a, b) => b.quantidadeAprovada - a.quantidadeAprovada)
      .slice(0, LIMITE_PERFORMANCE_MEDICO);

    const top = Math.min(LIMITE_PERFORMANCE_MEDICO, detalhes.length);

    return {
      top,
      labels: detalhesTop.map((d) => d.nomeMedico ?? 'Sem médico'),
      series: [
        {
          name: 'Quantidade aprovada',
          data: detalhesTop.map((d) => d.quantidadeAprovada),
        },
        {
          name: 'Taxa de conversão (%)',
          data: detalhesTop.map((d) => d.taxaConversao),
        },
      ],
      detalhes,
    };
  }

  private async buscarAnalisePerdas(
    filtros: DashboardFiltrosInternos,
  ): Promise<DashboardAnalisePerdasDto> {
    const qb = this.orcamentoRepo
      .createQueryBuilder('o')
      .leftJoin('o.motivoRejeicao', 'motivo')
      .select(
        `COALESCE(motivo.descricao, :semMotivo)`,
        'descricao',
      )
      .addSelect('motivo.id', 'motivoRejeicaoId')
      .addSelect('COUNT(*)', 'quantidade')
      .addSelect('COALESCE(SUM(o.precoVenda), 0)', 'valorPerdido')
      .where('o.status = :rejeitado', {
        rejeitado: OrcamentoStatus.REJEITADO,
      })
      .setParameter('semMotivo', SEM_MOTIVO_CLASSIFICACAO)
      .groupBy('motivo.id')
      .addGroupBy('motivo.descricao');

    this.aplicarFiltrosComuns(qb, filtros);

    const rows = (
      await qb.getRawMany<{
        descricao: string;
        motivoRejeicaoId: string | null;
        quantidade: string;
        valorPerdido: string;
      }>()
    ).sort(
      (a, b) => this.toNumber(b.valorPerdido) - this.toNumber(a.valorPerdido),
    );

    const items = rows.slice(0, LIMITE_PARETO).map((r) => ({
      motivoRejeicaoId: r.motivoRejeicaoId,
      descricao: r.descricao ?? SEM_MOTIVO_CLASSIFICACAO,
      quantidade: this.toInt(r.quantidade),
      valorPerdido: this.toNumber(r.valorPerdido),
      percentualAcumuladoQuantidade: 0,
      percentualAcumuladoValor: 0,
    }));

    const totalQtd = items.reduce((acc, i) => acc + i.quantidade, 0);
    const totalValor = items.reduce((acc, i) => acc + i.valorPerdido, 0);

    let accQtd = 0;
    let accValor = 0;
    const pareto = items.map((item) => {
      accQtd += item.quantidade;
      accValor += item.valorPerdido;
      return {
        ...item,
        percentualAcumuladoQuantidade:
          totalQtd > 0 ? this.round2((accQtd / totalQtd) * 100) : 0,
        percentualAcumuladoValor:
          totalValor > 0 ? this.round2((accValor / totalValor) * 100) : 0,
      };
    });

    return {
      labels: pareto.map((p) => p.descricao),
      series: [
        { name: 'Quantidade', data: pareto.map((p) => p.quantidade) },
        { name: 'Valor perdido', data: pareto.map((p) => p.valorPerdido) },
      ],
      pareto,
    };
  }

  private toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    const n = typeof value === 'number' ? value : parseFloat(String(value));
    return Number.isFinite(n) ? n : 0;
  }

  private toInt(value: string | number | null | undefined): number {
    return Math.round(this.toNumber(value));
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
