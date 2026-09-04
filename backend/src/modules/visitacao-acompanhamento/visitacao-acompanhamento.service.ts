import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import {
  ListaFechamentoEscopo,
  resolverEscopoListaFechamentoPorUsuario,
} from '../folha/utils/folha-unidade-scope.util';
import { PaginationMetaDto } from '../../common/dto/paginated-response.dto';
import { FindVisitacaoAcompanhamentoDto } from './dto/find-visitacao-acompanhamento.dto';
import { FindVisitacaoAcompanhamentoDetalheDto } from './dto/find-visitacao-acompanhamento-detalhe.dto';
import { VisitacaoAcompanhamentoItemDto } from './dto/visitacao-acompanhamento-item.dto';
import { VisitacaoAcompanhamentoListResponseDto } from './dto/visitacao-acompanhamento-list-response.dto';
import { VisitacaoAcompanhamentoDetalheDto } from './dto/visitacao-acompanhamento-detalhe.dto';
import { VisitacaoAcompanhamentoTotaisDto } from './dto/visitacao-acompanhamento-totais.dto';
import { VisitacaoAcompanhamentoTotaisRepresentanteDto } from './dto/visitacao-acompanhamento-totais-representante.dto';
import {
  VisitacaoAcompanhamentoOutraUnidadeDto,
  VisitacaoAcompanhamentoRecebidoUnidadeDto,
} from './dto/visitacao-acompanhamento-recebido-unidade.dto';
import { VisitacaoPainelMedicoRepresentanteDto } from '../visitacao-painel-medico/dto/visitacao-painel-medico-representante.dto';
import { VisitacaoAcompanhamentoOpcoesFiltroDto } from './dto/visitacao-acompanhamento-opcoes-filtro.dto';
import { VisitacaoMetaRepresentante } from '../visitacao-meta/entities/visitacao-meta-representante.entity';
import { VisitacaoComissaoFaixa } from '../visitacao-meta/entities/visitacao-comissao-faixa.entity';
import { VisitacaoRepresentanteUnidadeComissao } from '../visitacao-meta/entities/visitacao-representante-unidade-comissao.entity';
import { CalendarioUnidade } from '../producao-config/entities/calendario-unidade.entity';
import { ProducaoFeriado } from '../producao-config/entities/producao-feriado.entity';
import { CaixaFechamento } from '../fechamento-caixa/entities/caixa-fechamento.entity';
import { CaixaFechamentoStatus } from '../fechamento-caixa/enums/caixa-fechamento-status.enum';
import { PainelMedicoRepresentante } from '../painel-medicos/entities/painel-medico-representante.entity';
import { VisitacaoFechamento } from './entities/visitacao-fechamento.entity';
import { VisitacaoFechamentoCarteira } from './entities/visitacao-fechamento-carteira.entity';
import { VisitacaoFechamentoRepresentante } from './entities/visitacao-fechamento-representante.entity';
import { VisitacaoFechamentoMedico } from './entities/visitacao-fechamento-medico.entity';
import { VisitacaoFechamentoOutraUnidade } from './entities/visitacao-fechamento-outra-unidade.entity';
import { VisitacaoFechamentoRepresentanteUnidade } from './entities/visitacao-fechamento-representante-unidade.entity';
import { VisitacaoFechamentoStatus } from './enums/visitacao-fechamento-status.enum';
import { FecharVisitacaoDto } from './dto/fechar-visitacao.dto';
import { Permission } from '../../common/enums/permission.enum';
import { getUsuarioPermissoes } from '../../common/utils/usuario-permissoes.util';
import {
  competenciaAberta,
  PeriodoCompetencia,
  periodoCompetencia,
  somarDiasUteisVisitacao,
  somarDiasRealizadosVisitacao,
  ultimoDiaUtilCompetencia,
  ymdHojeSp,
} from './utils/visitacao-dias-uteis.util';

const NOME_SEM_REPRESENTANTE = 'Sem representante';

const INDICACAO_VAZIA: {
  recebido: { valor: number; quantidade: number };
  rejeitado: { valor: number; quantidade: number };
  porUnidade: VisitacaoAcompanhamentoOutraUnidadeDto[];
} = {
  recebido: { valor: 0, quantidade: 0 },
  rejeitado: { valor: 0, quantidade: 0 },
  porUnidade: [],
};

const RELACOES_RETRATO = [
  'representantes',
  'representantes.unidadesRecebido',
  'outrasUnidades',
] as const;

type StatusCompetenciaVisitacao = {
  competenciaStatus: 'ABERTO' | 'FECHADO';
  dataUltimoDiaUtil: string | null;
  caixaUltimoDiaUtilConfirmado: boolean;
  podeFechar: boolean;
  podeReabrir: boolean;
  mensagemGate: string | null;
  fechamento: VisitacaoFechamento | null;
};

type SqlBuild = {
  sql: string;
  params: unknown[];
};

type RowAgregado = {
  unidade: Unidade;
  nome_medico: string;
  crm: string;
  uf: string;
  nome_representante: string | null;
  na_carteira: boolean | string | number;
  unidade_carteira: Unidade | null;
  movimento_fora_carteira: boolean | string | number;
  valor_recebido: string | number;
  qtd_recebido: string | number;
  valor_rejeitado: string | number;
  qtd_rejeitado: string | number;
};

type TotaisRow = {
  valor_recebido: string | number | null;
  qtd_recebido: string | number | null;
  valor_rejeitado: string | number | null;
  qtd_rejeitado: string | number | null;
  qtd_medicos: string | number | null;
};

type TotaisRepresentanteRow = TotaisRow & {
  nome_representante: string | null;
  funcionario_id: string | null;
  valor_recebido_outras?: string | number | null;
  qtd_recebido_outras?: string | number | null;
  recebido_por_unidade?:
    | Array<{
        unidade: string;
        valor: string | number;
        quantidade: string | number;
      }>
    | string
    | null;
};

type RecebidoRow = {
  data_pagamento: string;
  numero_cupom: number;
  numero_requisicao: number;
  numero_orcamento: number | null;
  serie: string | null;
  valor_pago: string | number;
  nome_medico: string | null;
};

type RejeitadoRow = {
  data_orcamento: string;
  nr_orcamento: string;
  nome_cliente: string | null;
  preco_venda: string | number;
  motivo_rejeicao: string | null;
  nome_medico: string | null;
};

@Injectable()
export class VisitacaoAcompanhamentoService {
  private readonly logger = new Logger(VisitacaoAcompanhamentoService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Funcionario)
    private readonly funcionarioRepository: Repository<Funcionario>,
    @InjectRepository(VisitacaoMetaRepresentante)
    private readonly metaRepository: Repository<VisitacaoMetaRepresentante>,
    @InjectRepository(VisitacaoComissaoFaixa)
    private readonly faixaRepository: Repository<VisitacaoComissaoFaixa>,
    @InjectRepository(VisitacaoRepresentanteUnidadeComissao)
    private readonly unidadeComissaoRepository: Repository<VisitacaoRepresentanteUnidadeComissao>,
    @InjectRepository(CalendarioUnidade)
    private readonly calendarioRepository: Repository<CalendarioUnidade>,
    @InjectRepository(ProducaoFeriado)
    private readonly feriadoRepository: Repository<ProducaoFeriado>,
    @InjectRepository(CaixaFechamento)
    private readonly caixaFechamentoRepository: Repository<CaixaFechamento>,
    @InjectRepository(VisitacaoFechamento)
    private readonly visitacaoFechamentoRepository: Repository<VisitacaoFechamento>,
    @InjectRepository(VisitacaoFechamentoMedico)
    private readonly visitacaoFechamentoMedicoRepository: Repository<VisitacaoFechamentoMedico>,
    @InjectRepository(PainelMedicoRepresentante)
    private readonly painelRepository: Repository<PainelMedicoRepresentante>,
  ) {}

  async findAll(
    usuario: Usuario,
    dto: FindVisitacaoAcompanhamentoDto,
    statusPrevio?: StatusCompetenciaVisitacao,
  ): Promise<VisitacaoAcompanhamentoListResponseDto> {
    const iniciouEm = Date.now();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;
    const periodo = periodoCompetencia(dto.ano, dto.mes);
    const status =
      statusPrevio ?? (await this.resolverStatusCompetencia(usuario, dto));

    if (status.fechamento) {
      const retrato = await this.respostaRetrato(
        usuario,
        dto,
        status,
        page,
        limit,
        periodo,
      );
      this.logger.log(
        `Acompanhamento FECHADO ${dto.unidade ?? '-'} ${dto.ano}-${dto.mes} em ${Date.now() - iniciouEm}ms`,
      );
      return retrato;
    }

    const filtroRep = await this.resolverFiltroRepresentante(usuario, dto);
    if (filtroRep === 'VAZIO') {
      return this.respostaVazia(page, limit, periodo, status);
    }

    const { sql: baseSql, params } = this.montarSqlFiltrado(
      usuario,
      dto,
      filtroRep === 'NENHUM' ? null : filtroRep,
      periodo,
    );

    const orderSql = this.montarOrderBy(dto);
    const semPaginacao = dto.todos === true;
    let combinedSql: string;
    let combinedParams: unknown[] = params;
    if (semPaginacao) {
      combinedSql = this.montarSqlListagemCombinada(baseSql, orderSql, null);
    } else {
      combinedParams = [...params, limit, (page - 1) * limit];
      combinedSql = this.montarSqlListagemCombinada(
        baseSql,
        orderSql,
        { limitIdx: params.length + 1, offsetIdx: params.length + 2 },
      );
    }

    const combinedRows = (await this.dataSource.query(
      combinedSql,
      combinedParams,
    )) as Array<{
      totais_por_representante: TotaisRepresentanteRow[] | null;
      data: RowAgregado[] | null;
    }>;
    const combined = combinedRows[0];
    const grupos = this.asJsonArray<TotaisRepresentanteRow>(
      combined?.totais_por_representante,
    ).map((row) => this.mapTotaisRepresentante(row, periodo));
    const totais = this.somarTotais(grupos, periodo);
    const totaisPorRepresentante = grupos.filter(
      (g) => g.nomeRepresentante !== NOME_SEM_REPRESENTANTE,
    );
    const rows = this.asJsonArray<RowAgregado>(combined?.data);

    const escopo = resolverEscopoListaFechamentoPorUsuario(
      usuario,
      dto.unidade,
    );
    const unidadePainel = escopo === 'ALL' ? null : escopo;
    const exporComissao = getUsuarioPermissoes(usuario).includes(
      Permission.VISITACAO_ACOMPANHAMENTO_COMISSAO,
    );
    const extrasPromise = unidadePainel
      ? this.listarUnidadesComissaoExtras(unidadePainel)
      : Promise.resolve([] as Unidade[]);

    const [caixa, rejeitadoLoja, indicacao] = await Promise.all([
      this.consultarRecebidoCaixa(escopo, periodo),
      this.consultarRejeitadoLoja(escopo, periodo),
      unidadePainel
        ? extrasPromise.then((extras) =>
            this.consultarIndicacaoOutrasUnidades(
              unidadePainel,
              periodo,
              extras,
            ),
          )
        : Promise.resolve(INDICACAO_VAZIA),
      this.aplicarUnidadesComissaoNosCards(grupos),
      this.anexarDesempenho(
        totaisPorRepresentante,
        totais,
        periodo,
        dto.unidade ?? unidadePainel,
        exporComissao,
      ),
      extrasPromise.then((extras) =>
        this.anexarEstatisticasPainel(
          totaisPorRepresentante,
          totais,
          periodo,
          unidadePainel,
          extras,
        ),
      ),
    ]);
    totais.valorRecebidoCaixa = caixa.valor;
    totais.quantidadeRecebidoCaixa = caixa.quantidade;
    totais.valorRejeitadoLoja = rejeitadoLoja.valor;
    totais.quantidadeRejeitadoLoja = rejeitadoLoja.quantidade;
    totais.valorRecebidoOutrasUnidades = indicacao.recebido.valor;
    totais.quantidadeRecebidoOutrasUnidades = indicacao.recebido.quantidade;
    totais.valorRejeitadoOutrasUnidades = indicacao.rejeitado.valor;
    totais.quantidadeRejeitadoOutrasUnidades = indicacao.rejeitado.quantidade;
    totais.outrasUnidades = indicacao.porUnidade;

    this.logger.log(
      `Acompanhamento ABERTO ${dto.unidade ?? '-'} ${dto.ano}-${dto.mes} em ${Date.now() - iniciouEm}ms`,
    );
    return {
      data: rows.map((row) => this.mapItem(row)),
      meta: new PaginationMetaDto(page, limit, totais.quantidadeMedicos),
      totais,
      totaisPorRepresentante,
      ...this.camposStatusDto(status),
    };
  }

  async listarOpcoesFiltro(
    usuario: Usuario,
    dto: FindVisitacaoAcompanhamentoDto,
  ): Promise<VisitacaoAcompanhamentoOpcoesFiltroDto> {
    const periodo = periodoCompetencia(dto.ano, dto.mes);
    const dtoOpcoes = { ...dto, nomesMedico: undefined };
    const filtroRep = await this.resolverFiltroRepresentante(usuario, dtoOpcoes);
    if (filtroRep === 'VAZIO') {
      return { medicos: [] };
    }

    const { sql: baseSql, params } = this.montarSqlFiltrado(
      usuario,
      dtoOpcoes,
      filtroRep === 'NENHUM' ? null : filtroRep,
      periodo,
    );

    const sql = `
      WITH filtered AS MATERIALIZED (
        ${baseSql}
      )
      SELECT
        CONCAT(
          COALESCE(NULLIF(BTRIM(f.nome_medico), ''), 'Sem médico'),
          ' - ',
          f.unidade
        ) AS nome,
        COALESCE(SUM(f.qtd_recebido), 0)::int + COALESCE(SUM(f.qtd_rejeitado), 0)::int AS total,
        COALESCE(SUM(f.qtd_recebido), 0)::int AS aprovados,
        COALESCE(SUM(f.qtd_rejeitado), 0)::int AS rejeitados
      FROM filtered f
      GROUP BY 1
      ORDER BY nome ASC
    `;
    const rows = (await this.dataSource.query(sql, params)) as Array<{
      nome: string;
      total: string | number;
      aprovados: string | number;
      rejeitados: string | number;
    }>;

    return {
      medicos: rows.map((r) => ({
        nome: r.nome,
        total: this.toInt(r.total),
        aprovados: this.toInt(r.aprovados),
        rejeitados: this.toInt(r.rejeitados),
      })),
    };
  }

  async detalhe(
    usuario: Usuario,
    dto: FindVisitacaoAcompanhamentoDetalheDto,
  ): Promise<VisitacaoAcompanhamentoDetalheDto> {
    this.assertPeriodo(dto.dataInicial, dto.dataFinal);

    const crm = dto.crmMedico.trim();
    const uf = dto.ufCrmMedico.trim().toUpperCase();
    if (!crm || !uf) {
      throw new BadRequestException(
        'CRM e UF são obrigatórios para o detalhe do movimento.',
      );
    }

    const escopo = resolverEscopoListaFechamentoPorUsuario(
      usuario,
      dto.unidade,
    );
    if (escopo !== 'ALL' && dto.unidade !== escopo) {
      const naCarteira = await this.crmExisteNoPainel(escopo, crm, uf);
      if (!naCarteira) {
        throw new NotFoundException(
          'Médico não encontrado no escopo do usuário.',
        );
      }
      const unidadeComissao = await this.crmUnidadeComissaoPermitida(
        escopo,
        dto.unidade,
        crm,
        uf,
      );
      if (!unidadeComissao) {
        throw new NotFoundException(
          'Médico não encontrado no escopo do usuário.',
        );
      }
    }

    const params: unknown[] = [
      dto.unidade,
      crm,
      uf,
      dto.dataInicial,
      dto.dataFinal,
    ];

    const recebidosSql = `
      SELECT
        t.data_pagamento,
        t.numero_cupom,
        t.numero_requisicao,
        t.numero_orcamento,
        t.serie,
        t.valor_pago,
        t.nome_medico
      FROM (
        SELECT DISTINCT ON (
          i.numero_cupom,
          i.numero_requisicao,
          COALESCE(NULLIF(BTRIM(f.serie), ''), ''),
          ${this.sqlCrmPrescritor()}
        )
          COALESCE(c.data_pagamento, i.data_operacao) AS data_pagamento,
          i.numero_cupom,
          i.numero_requisicao,
          COALESCE(f.numero_orcamento, c.numero_orcamento) AS numero_orcamento,
          NULLIF(BTRIM(f.serie), '') AS serie,
          ${this.sqlValorRecebidoPrescritorOuSerie()} AS valor_pago,
          ${this.sqlNomePrescritor()} AS nome_medico
        FROM caixa_itens_erp i
        ${this.sqlJoinCaixaPago()}
        ${this.sqlJoinFormulaSerie()}
        WHERE i.tipo_item = 'REQUISICAO'
          AND i.numero_requisicao IS NOT NULL
          AND i.unidade = $1
          ${this.sqlFiltroPeriodoRecebido('$4', '$5')}
          ${this.sqlFiltroRecebidoVisitacao()}
          AND ${this.sqlCrmPrescritor()} = $2
          AND ${this.sqlUfPrescritor()} = $3
        ORDER BY
          i.numero_cupom,
          i.numero_requisicao,
          COALESCE(NULLIF(BTRIM(f.serie), ''), ''),
          ${this.sqlCrmPrescritor()},
          i.id
      ) t
      ORDER BY t.data_pagamento ASC, t.numero_cupom ASC, t.numero_requisicao ASC, t.serie ASC NULLS LAST
    `;

    const rejeitadosSql = `
      SELECT
        o."dataOrcamento" AS data_orcamento,
        o."nrOrcamento" AS nr_orcamento,
        o."nomeCliente" AS nome_cliente,
        o."precoVenda" AS preco_venda,
        m.descricao AS motivo_rejeicao,
        o."nomeMedico" AS nome_medico
      FROM orcamentos o
      LEFT JOIN orcamento_motivo_rejeicao m ON m.id = o."motivoRejeicaoId"
      WHERE o.status = 'REJEITADO'
        AND o.unidade = $1
        AND BTRIM(o."crmMedico") = $2
        AND UPPER(BTRIM(o."ufcrmMedico")) = $3
        AND o."dataOrcamento" >= $4
        AND o."dataOrcamento" <= $5
      ORDER BY o."dataOrcamento" ASC, o."nrOrcamento" ASC
    `;

    const [recebidos, rejeitados] = await Promise.all([
      this.dataSource.query(recebidosSql, params) as Promise<RecebidoRow[]>,
      this.dataSource.query(rejeitadosSql, params) as Promise<RejeitadoRow[]>,
    ]);

    const nomeMedico =
      dto.nomeMedico?.trim() ||
      recebidos.find((r) => r.nome_medico?.trim())?.nome_medico?.trim() ||
      rejeitados.find((r) => r.nome_medico?.trim())?.nome_medico?.trim() ||
      '—';

    return {
      unidade: dto.unidade,
      nomeMedico,
      crmMedico: crm,
      ufCrmMedico: uf,
      recebidos: recebidos.map((r) => ({
        dataPagamento: r.data_pagamento,
        numeroCupom: Number(r.numero_cupom) || 0,
        numeroRequisicao: Number(r.numero_requisicao) || 0,
        numeroOrcamento:
          r.numero_orcamento == null ? null : Number(r.numero_orcamento),
        serie: r.serie?.trim() || null,
        valorPago: this.toNumber(r.valor_pago),
      })),
      rejeitados: rejeitados.map((r) => ({
        dataOrcamento: r.data_orcamento,
        nrOrcamento: r.nr_orcamento,
        nomeCliente: r.nome_cliente,
        precoVenda: this.toNumber(r.preco_venda),
        motivoRejeicao: r.motivo_rejeicao,
      })),
    };
  }

  async listarRepresentantesVinculados(
    usuario: Usuario,
    unidade?: Unidade,
  ): Promise<VisitacaoPainelMedicoRepresentanteDto[]> {
    const escopo = resolverEscopoListaFechamentoPorUsuario(usuario, unidade);

    const qb = this.funcionarioRepository
      .createQueryBuilder('f')
      .where('f.painelContratoRepresentante IS NOT NULL')
      .andWhere('f.painelCodigoRepresentante IS NOT NULL');

    if (escopo !== 'ALL') {
      qb.andWhere('f.unidade = :unidadeEscopo', { unidadeEscopo: escopo });
    }

    const rows = await qb.orderBy('f.nome', 'ASC').getMany();

    return rows.map((f) => ({
      id: f.id,
      nome: f.nome,
      unidade: f.unidade,
      painelContratoRepresentante: f.painelContratoRepresentante!,
      painelCodigoRepresentante: f.painelCodigoRepresentante!,
    }));
  }

  async fechar(
    usuario: Usuario,
    dto: FecharVisitacaoDto,
  ): Promise<VisitacaoAcompanhamentoListResponseDto> {
    const iniciouEm = Date.now();
    const unidade = this.assertUnidadeFechamento(usuario, dto.unidade);
    const status = await this.resolverStatusCompetencia(usuario, {
      ano: dto.ano,
      mes: dto.mes,
      unidade,
    });
    if (status.fechamento) {
      throw new ConflictException(
        'A visitação desta unidade já está fechada nesta competência.',
      );
    }
    if (!status.caixaUltimoDiaUtilConfirmado || !status.dataUltimoDiaUtil) {
      throw new ConflictException(
        status.mensagemGate ??
          `Não é possível fechar a visitação: o caixa de ${unidade} ainda não está confirmado.`,
      );
    }

    const [live, painel, funcionarios] = await Promise.all([
      this.findAll(
        usuario,
        {
          ano: dto.ano,
          mes: dto.mes,
          unidade,
          todos: true,
          naCarteira: 'todos',
        },
        status,
      ),
      this.painelRepository.find({ where: { unidade } }),
      this.funcionarioRepository.find({ where: { unidade } }),
    ]);
    const funcPorPar = new Map(
      funcionarios
        .filter(
          (f) =>
            f.painelContratoRepresentante != null &&
            f.painelCodigoRepresentante != null,
        )
        .map((f) => [
          `${f.painelContratoRepresentante}-${f.painelCodigoRepresentante}`,
          f,
        ]),
    );

    const header = this.visitacaoFechamentoRepository.create({
      unidade,
      ano: dto.ano,
      mes: dto.mes,
      status: VisitacaoFechamentoStatus.FECHADO,
      dataUltimoDiaUtil: status.dataUltimoDiaUtil,
      recebidoLoja: live.totais.valorRecebidoCaixa ?? 0,
      quantidadeRecebidoLoja: live.totais.quantidadeRecebidoCaixa ?? 0,
      rejeitadoLoja: live.totais.valorRejeitadoLoja ?? 0,
      quantidadeRejeitadoLoja: live.totais.quantidadeRejeitadoLoja ?? 0,
      recebidoOutras: live.totais.valorRecebidoOutrasUnidades ?? 0,
      quantidadeRecebidoOutras: live.totais.quantidadeRecebidoOutrasUnidades ?? 0,
      rejeitadoOutras: live.totais.valorRejeitadoOutrasUnidades ?? 0,
      quantidadeRejeitadoOutras:
        live.totais.quantidadeRejeitadoOutrasUnidades ?? 0,
      fechadoEm: new Date(),
      fechadoPor: usuario,
    });

    await this.dataSource.transaction(async (manager) => {
      const salvo = await manager.save(VisitacaoFechamento, header);
      const carteira = painel.map((p) =>
        manager.create(VisitacaoFechamentoCarteira, {
          fechamentoId: salvo.id,
          funcionario:
            funcPorPar.get(
              `${p.contratoRepresentante}-${p.codigoRepresentante}`,
            ) ?? null,
          crmMedico: p.crmMedico,
          ufCrmMedico: p.ufCrmMedico,
          nomeMedico: p.nomeMedico,
          contratoRepresentante: p.contratoRepresentante,
          codigoRepresentante: p.codigoRepresentante,
          nomeRepresentante: p.nomeRepresentante,
        }),
      );
      if (carteira.length) {
        await manager.save(VisitacaoFechamentoCarteira, carteira, {
          chunk: 250,
        });
      }

      const outras = (live.totais.outrasUnidades ?? []).map((bloco) =>
        manager.create(VisitacaoFechamentoOutraUnidade, {
          fechamentoId: salvo.id,
          unidade: bloco.unidade,
          valorRecebido: bloco.valorRecebido,
          quantidadeRecebido: bloco.quantidadeRecebido,
          valorRejeitado: bloco.valorRejeitado,
          quantidadeRejeitado: bloco.quantidadeRejeitado,
        }),
      );
      if (outras.length) {
        await manager.save(VisitacaoFechamentoOutraUnidade, outras);
      }

      const reps = live.totaisPorRepresentante
        .filter((r) => !!r.funcionarioId)
        .map((r) => {
          const func = funcionarios.find((f) => f.id === r.funcionarioId);
          return manager.create(VisitacaoFechamentoRepresentante, {
            fechamentoId: salvo.id,
            funcionarioId: r.funcionarioId!,
            nomeRepresentante: r.nomeRepresentante,
            contratoRepresentante: func?.painelContratoRepresentante ?? 0,
            codigoRepresentante: func?.painelCodigoRepresentante ?? 0,
            recebidoLoja: r.valorRecebido,
            quantidadeRecebido: r.quantidadeRecebido,
            rejeitadoLoja: r.valorRejeitado,
            quantidadeRejeitado: r.quantidadeRejeitado,
            valorRecebidoOutras: r.valorRecebidoOutrasUnidades ?? 0,
            quantidadeRecebidoOutras: r.quantidadeRecebidoOutrasUnidades ?? 0,
            valorRejeitadoOutras: r.valorRejeitadoOutrasUnidades ?? 0,
            quantidadeRejeitadoOutras: r.quantidadeRejeitadoOutrasUnidades ?? 0,
            unidadesComissao: r.unidadesComissao?.length
              ? r.unidadesComissao
              : [unidade],
            representatividade:
              (live.totais.valorRecebidoCaixa ?? 0) > 0
                ? r.valorRecebido / (live.totais.valorRecebidoCaixa ?? 1)
                : null,
            valorMeta: r.valorMeta ?? null,
            percentualMeta: r.percentualMeta ?? null,
            percentualFaixa: r.percentualComissaoFaixa ?? null,
            valorComissao: r.valorComissao ?? null,
            qtdComMovimento: r.quantidadeMedicos,
            qtdAtivosPainel: r.quantidadeMedicosPainel ?? 0,
            qtdForaAtendimento: r.quantidadeMedicosForaAtendimento ?? 0,
          });
        });
      const repsSalvos = reps.length
        ? await manager.save(VisitacaoFechamentoRepresentante, reps)
        : [];
      const unidRep: VisitacaoFechamentoRepresentanteUnidade[] = [];
      for (const salvoRep of repsSalvos) {
        const liveRep = live.totaisPorRepresentante.find(
          (r) => r.funcionarioId === salvoRep.funcionarioId,
        );
        const porUnidade = liveRep?.recebidoPorUnidade ?? [];
        const map = new Map(porUnidade.map((item) => [item.unidade, item]));
        const unidades = (liveRep?.unidadesComissao?.length
          ? liveRep.unidadesComissao
          : [...map.keys()]) as Unidade[];
        const vistas = new Set<string>();
        for (const u of unidades) {
          if (!u || vistas.has(u)) continue;
          vistas.add(u);
          const item = map.get(u);
          unidRep.push(
            manager.create(VisitacaoFechamentoRepresentanteUnidade, {
              fechamentoRepresentanteId: salvoRep.id,
              unidade: u,
              valor: item?.valor ?? 0,
              quantidade: item?.quantidade ?? 0,
            }),
          );
        }
      }
      if (unidRep.length) {
        await manager.save(VisitacaoFechamentoRepresentanteUnidade, unidRep);
      }

      const funcPorId = new Map(funcionarios.map((f) => [f.id, f]));
      const funcPorNome = new Map(
        live.totaisPorRepresentante
          .filter((r) => r.funcionarioId)
          .map((r) => [r.nomeRepresentante, r.funcionarioId!]),
      );
      const medicos = live.data.map((item) => {
        const vinculo = painel.find(
          (p) =>
            p.crmMedico.trim() === item.crmMedico.trim() &&
            p.ufCrmMedico.trim().toUpperCase() ===
              item.ufCrmMedico.trim().toUpperCase(),
        );
        const funcPorPainel = vinculo
          ? funcPorPar.get(
              `${vinculo.contratoRepresentante}-${vinculo.codigoRepresentante}`,
            )
          : undefined;
        const funcPorCard = item.nomeRepresentante
          ? funcPorId.get(funcPorNome.get(item.nomeRepresentante) ?? '')
          : undefined;
        return manager.create(VisitacaoFechamentoMedico, {
          fechamentoId: salvo.id,
          funcionario: funcPorPainel ?? funcPorCard ?? null,
          unidade: item.unidade,
          unidadeCarteira: item.unidadeCarteira ?? null,
          movimentoForaCarteira: !!item.movimentoForaCarteira,
          crmMedico: item.crmMedico,
          ufCrmMedico: item.ufCrmMedico,
          nomeMedico: item.nomeMedico,
          nomeRepresentante: item.nomeRepresentante ?? null,
          recebidoLoja: item.valorRecebido,
          quantidadeRecebido: item.quantidadeRecebido,
          rejeitadoLoja: item.valorRejeitado,
          quantidadeRejeitado: item.quantidadeRejeitado,
          naCarteira: item.naCarteira,
        });
      });
      if (medicos.length) {
        await manager.save(VisitacaoFechamentoMedico, medicos, { chunk: 250 });
      }
    });

    this.logger.log(
      `Fechamento ${unidade} ${dto.ano}-${dto.mes} em ${Date.now() - iniciouEm}ms`,
    );
    return this.montarRespostaFechadaDoLive(usuario, live, status);
  }

  async reabrir(
    usuario: Usuario,
    dto: FecharVisitacaoDto,
  ): Promise<VisitacaoAcompanhamentoListResponseDto> {
    const unidade = this.assertUnidadeFechamento(usuario, dto.unidade);
    const existente = await this.visitacaoFechamentoRepository.findOne({
      where: { unidade, ano: dto.ano, mes: dto.mes },
    });
    if (!existente) {
      throw new ConflictException(
        'A visitação desta unidade não está fechada nesta competência.',
      );
    }
    await this.visitacaoFechamentoRepository.remove(existente);
    return this.findAll(usuario, {
      ano: dto.ano,
      mes: dto.mes,
      unidade,
    });
  }

  private assertUnidadeFechamento(usuario: Usuario, unidade: Unidade): Unidade {
    const escopo = resolverEscopoListaFechamentoPorUsuario(usuario, unidade);
    if (escopo !== 'ALL' && escopo !== unidade) {
      throw new BadRequestException(
        'Não é possível fechar a visitação de outra unidade.',
      );
    }
    return unidade;
  }

  private async resolverStatusCompetencia(
    usuario: Usuario,
    dto: Pick<FindVisitacaoAcompanhamentoDto, 'ano' | 'mes' | 'unidade'>,
  ): Promise<StatusCompetenciaVisitacao> {
    const periodo = periodoCompetencia(dto.ano, dto.mes);
    const escopo = resolverEscopoListaFechamentoPorUsuario(
      usuario,
      dto.unidade,
    );
    const unidade = escopo === 'ALL' ? dto.unidade ?? null : escopo;
    const permissoes = getUsuarioPermissoes(usuario);
    const podePermFechar = permissoes.includes(
      Permission.VISITACAO_FECHAMENTO_FECHAR,
    );
    const podePermReabrir = permissoes.includes(
      Permission.VISITACAO_FECHAMENTO_REABRIR,
    );

    if (!unidade) {
      return {
        competenciaStatus: 'ABERTO',
        dataUltimoDiaUtil: null,
        caixaUltimoDiaUtilConfirmado: false,
        podeFechar: false,
        podeReabrir: false,
        mensagemGate: 'Informe a unidade para fechar a visitação.',
        fechamento: null,
      };
    }

    const fechamento = await this.visitacaoFechamentoRepository.findOne({
      where: { unidade, ano: dto.ano, mes: dto.mes },
      relations: [...RELACOES_RETRATO],
    });

    if (fechamento) {
      return {
        competenciaStatus: 'FECHADO',
        dataUltimoDiaUtil: fechamento.dataUltimoDiaUtil,
        caixaUltimoDiaUtilConfirmado: true,
        podeFechar: false,
        podeReabrir: podePermReabrir,
        mensagemGate: null,
        fechamento,
      };
    }

    const [calendario, feriados] = await Promise.all([
      this.calendarioRepository.findOne({
        where: { unidade },
      }),
      this.feriadoRepository
        .createQueryBuilder('f')
        .where('f.unidade = :unidade', { unidade })
        .andWhere('f.data >= :ini AND f.data <= :fim', {
          ini: periodo.dataInicial,
          fim: periodo.dataFinal,
        })
        .getMany(),
    ]);
    const feriadoSet = new Set(feriados.map((f) => f.data));
    const dataUltimoDiaUtil = ultimoDiaUtilCompetencia(
      periodo.dataInicial,
      periodo.dataFinal,
      calendario?.sabadoDiaUtil ?? false,
      feriadoSet,
    );
    let caixaConfirmado = false;
    if (dataUltimoDiaUtil) {
      const caixa = await this.caixaFechamentoRepository.findOne({
        where: {
          unidade,
          dataOperacao: dataUltimoDiaUtil,
          status: CaixaFechamentoStatus.CONFIRMADO,
        },
      });
      caixaConfirmado = !!caixa;
    }
    const mensagemGate = !dataUltimoDiaUtil
      ? `Não há dia útil em ${unidade} nesta competência.`
      : !caixaConfirmado
        ? `Não é possível fechar a visitação: o caixa de ${unidade} em ${dataUltimoDiaUtil} ainda não está confirmado.`
        : null;

    return {
      competenciaStatus: 'ABERTO',
      dataUltimoDiaUtil,
      caixaUltimoDiaUtilConfirmado: caixaConfirmado,
      podeFechar: podePermFechar && caixaConfirmado,
      podeReabrir: false,
      mensagemGate,
      fechamento: null,
    };
  }

  private camposStatusDto(
    status: StatusCompetenciaVisitacao,
  ): Pick<
    VisitacaoAcompanhamentoListResponseDto,
    | 'competenciaStatus'
    | 'dataUltimoDiaUtil'
    | 'caixaUltimoDiaUtilConfirmado'
    | 'podeFechar'
    | 'podeReabrir'
    | 'mensagemGate'
  > {
    return {
      competenciaStatus: status.competenciaStatus,
      dataUltimoDiaUtil: status.dataUltimoDiaUtil,
      caixaUltimoDiaUtilConfirmado: status.caixaUltimoDiaUtilConfirmado,
      podeFechar: status.podeFechar,
      podeReabrir: status.podeReabrir,
      mensagemGate: status.mensagemGate,
    };
  }

  private montarRespostaFechadaDoLive(
    usuario: Usuario,
    live: VisitacaoAcompanhamentoListResponseDto,
    statusAberto: StatusCompetenciaVisitacao,
    page = 1,
    limit = 50,
  ): VisitacaoAcompanhamentoListResponseDto {
    const podeReabrir = getUsuarioPermissoes(usuario).includes(
      Permission.VISITACAO_FECHAMENTO_REABRIR,
    );
    const statusFechado: StatusCompetenciaVisitacao = {
      ...statusAberto,
      competenciaStatus: 'FECHADO',
      caixaUltimoDiaUtilConfirmado: true,
      podeFechar: false,
      podeReabrir,
      mensagemGate: null,
      fechamento: null,
    };
    const zerarProjecao = <
      T extends {
        mesAberto?: boolean;
        valorProjetado?: number | null;
        percentualProjecao?: number | null;
        percentualComissaoFaixaProjetada?: number | null;
        valorComissaoProjetado?: number | null;
      },
    >(
      item: T,
    ): T => ({
      ...item,
      mesAberto: false,
      valorProjetado: null,
      percentualProjecao: null,
      percentualComissaoFaixaProjetada: null,
      valorComissaoProjetado: null,
    });
    const totalMedicos = live.meta.total;
    const data = live.data.slice((page - 1) * limit, page * limit);
    return {
      data,
      meta: new PaginationMetaDto(page, limit, totalMedicos),
      totais: zerarProjecao({ ...live.totais }),
      totaisPorRepresentante: live.totaisPorRepresentante.map((g) =>
        zerarProjecao({ ...g }),
      ),
      ...this.camposStatusDto(statusFechado),
    };
  }

  private async respostaRetrato(
    usuario: Usuario,
    dto: FindVisitacaoAcompanhamentoDto,
    status: StatusCompetenciaVisitacao,
    page: number,
    limit: number,
    periodo: PeriodoCompetencia,
  ): Promise<VisitacaoAcompanhamentoListResponseDto> {
    const fechamento = status.fechamento!;
    const exporComissao = getUsuarioPermissoes(usuario).includes(
      Permission.VISITACAO_ACOMPANHAMENTO_COMISSAO,
    );
    const { medicos, totalMedicos } = await this.consultarMedicosRetrato(
      fechamento.id,
      dto,
      page,
      limit,
    );

    const data = medicos.map((m) => ({
      unidade: m.unidade ?? fechamento.unidade,
      nomeMedico: m.nomeMedico,
      crmMedico: m.crmMedico,
      ufCrmMedico: m.ufCrmMedico,
      nomeRepresentante:
        m.nomeRepresentante ?? m.funcionario?.nome ?? null,
      naCarteira: m.naCarteira,
      unidadeCarteira: m.unidadeCarteira ?? (m.naCarteira ? fechamento.unidade : null),
      movimentoForaCarteira: !!m.movimentoForaCarteira,
      valorRecebido: Number(m.recebidoLoja) || 0,
      quantidadeRecebido: m.quantidadeRecebido ?? 0,
      valorRejeitado: Number(m.rejeitadoLoja) || 0,
      quantidadeRejeitado: m.quantidadeRejeitado ?? 0,
    }));

    const totaisPorRepresentante = (fechamento.representantes ?? []).map(
      (r) => {
        const recebidoPorUnidade = this.mapRetratoRecebidoPorUnidade(
          r,
          fechamento.unidade,
        );
        const grupo: VisitacaoAcompanhamentoTotaisRepresentanteDto = {
          nomeRepresentante: r.nomeRepresentante,
          funcionarioId: r.funcionarioId,
          valorRecebido: Number(r.recebidoLoja) || 0,
          quantidadeRecebido: r.quantidadeRecebido ?? 0,
          valorRejeitado: Number(r.rejeitadoLoja) || 0,
          quantidadeRejeitado: r.quantidadeRejeitado ?? 0,
          quantidadeMedicos: r.qtdComMovimento,
          valorRecebidoCaixa: Number(fechamento.recebidoLoja) || 0,
          quantidadeRecebidoCaixa: fechamento.quantidadeRecebidoLoja ?? 0,
          valorRecebidoOutrasUnidades: Number(r.valorRecebidoOutras) || 0,
          quantidadeRecebidoOutrasUnidades: r.quantidadeRecebidoOutras ?? 0,
          valorRejeitadoLoja: Number(r.rejeitadoLoja) || 0,
          quantidadeRejeitadoLoja: r.quantidadeRejeitado ?? 0,
          valorRejeitadoOutrasUnidades: Number(r.valorRejeitadoOutras) || 0,
          quantidadeRejeitadoOutrasUnidades: r.quantidadeRejeitadoOutras ?? 0,
          recebidoPorUnidade,
          unidadesComissao: r.unidadesComissao?.length
            ? r.unidadesComissao
            : recebidoPorUnidade.map((item) => item.unidade),
          quantidadeMedicosPainel: r.qtdAtivosPainel,
          quantidadeMedicosForaAtendimento: r.qtdForaAtendimento,
          valorMeta: r.valorMeta,
          percentualMeta: r.percentualMeta,
          percentualComissaoFaixa: exporComissao ? r.percentualFaixa : null,
          valorComissao: exporComissao ? r.valorComissao : null,
          valorProjetado: null,
          percentualProjecao: null,
          percentualComissaoFaixaProjetada: null,
          valorComissaoProjetado: null,
          mesAberto: false,
          quantidadeRepresentantes: 1,
          quantidadeComMeta: r.valorMeta != null && r.valorMeta > 0 ? 1 : 0,
        };
        return grupo;
      },
    );

    const outrasUnidades: VisitacaoAcompanhamentoOutraUnidadeDto[] = (
      fechamento.outrasUnidades ?? []
    ).map((bloco) => ({
      unidade: bloco.unidade,
      valorRecebido: Number(bloco.valorRecebido) || 0,
      quantidadeRecebido: bloco.quantidadeRecebido ?? 0,
      valorRejeitado: Number(bloco.valorRejeitado) || 0,
      quantidadeRejeitado: bloco.quantidadeRejeitado ?? 0,
    }));

    const totais: VisitacaoAcompanhamentoTotaisDto = {
      valorRecebido: Number(fechamento.recebidoLoja) || 0,
      quantidadeRecebido: fechamento.quantidadeRecebidoLoja ?? 0,
      valorRejeitado: Number(fechamento.rejeitadoLoja) || 0,
      quantidadeRejeitado: fechamento.quantidadeRejeitadoLoja ?? 0,
      quantidadeMedicos: totalMedicos,
      valorRecebidoCaixa: Number(fechamento.recebidoLoja) || 0,
      quantidadeRecebidoCaixa: fechamento.quantidadeRecebidoLoja ?? 0,
      valorRecebidoOutrasUnidades: Number(fechamento.recebidoOutras) || 0,
      quantidadeRecebidoOutrasUnidades: fechamento.quantidadeRecebidoOutras ?? 0,
      valorRejeitadoLoja: Number(fechamento.rejeitadoLoja) || 0,
      quantidadeRejeitadoLoja: fechamento.quantidadeRejeitadoLoja ?? 0,
      valorRejeitadoOutrasUnidades: Number(fechamento.rejeitadoOutras) || 0,
      quantidadeRejeitadoOutrasUnidades:
        fechamento.quantidadeRejeitadoOutras ?? 0,
      outrasUnidades,
      quantidadeMedicosPainel: totaisPorRepresentante.reduce(
        (s, g) => s + (g.quantidadeMedicosPainel ?? 0),
        0,
      ),
      quantidadeMedicosForaAtendimento: totaisPorRepresentante.reduce(
        (s, g) => s + (g.quantidadeMedicosForaAtendimento ?? 0),
        0,
      ),
      ...this.desempenhoBase(periodo),
      mesAberto: false,
      valorMeta: totaisPorRepresentante.reduce(
        (s, g) => s + (g.valorMeta ?? 0),
        0,
      ) || null,
      quantidadeRepresentantes: totaisPorRepresentante.length,
      quantidadeComMeta: totaisPorRepresentante.filter(
        (g) => g.quantidadeComMeta > 0,
      ).length,
    };
    if (totais.valorMeta && totais.valorMeta > 0) {
      totais.percentualMeta = (totais.valorRecebido / totais.valorMeta) * 100;
    }

    return {
      data,
      meta: new PaginationMetaDto(page, limit, totalMedicos),
      totais,
      totaisPorRepresentante,
      ...this.camposStatusDto(status),
    };
  }

  private async consultarMedicosRetrato(
    fechamentoId: string,
    dto: FindVisitacaoAcompanhamentoDto,
    page: number,
    limit: number,
  ): Promise<{ medicos: VisitacaoFechamentoMedico[]; totalMedicos: number }> {
    const qb = this.visitacaoFechamentoMedicoRepository
      .createQueryBuilder('m')
      .where('m.fechamento_id = :fechamentoId', { fechamentoId });

    if (dto.nomeMedico?.trim()) {
      qb.andWhere('m.nome_medico ILIKE :nomeMedico', {
        nomeMedico: `%${dto.nomeMedico.trim()}%`,
      });
    }
    if (dto.nomesMedico?.length) {
      qb.andWhere(
        `CONCAT(m.nome_medico, ' - ', m.unidade) IN (:...nomesMedico)`,
        { nomesMedico: dto.nomesMedico },
      );
    }
    if (dto.crmMedico?.trim()) {
      qb.andWhere('m.crm_medico ILIKE :crmMedico', {
        crmMedico: `%${dto.crmMedico.trim()}%`,
      });
    }
    if (dto.ufCrmMedico?.trim()) {
      qb.andWhere('UPPER(BTRIM(m.uf_crm_medico)) = :ufCrm', {
        ufCrm: dto.ufCrmMedico.trim().toUpperCase(),
      });
    }
    if (dto.funcionarioId) {
      qb.innerJoin('m.funcionario', 'func').andWhere('func.id = :fid', {
        fid: dto.funcionarioId,
      });
    }
    if (dto.naCarteira === 'sim') {
      qb.andWhere('m.na_carteira = TRUE');
    }
    if (dto.naCarteira === 'nao') {
      qb.andWhere('m.na_carteira = FALSE');
    }

    const colunas: Record<string, string> = {
      unidade: 'm.unidade',
      nomeMedico: 'm.nome_medico',
      crmMedico: 'm.crm_medico',
      nomeRepresentante: 'm.nome_representante',
      naCarteira: 'm.na_carteira',
      valorRecebido: 'm.recebido_loja',
      valorRejeitado: 'm.rejeitado_loja',
    };
    const coluna =
      colunas[dto.ordenarPor ?? 'valorRecebido'] ?? colunas.valorRecebido;
    const direcao = dto.ordem === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(coluna, direcao, 'NULLS LAST')
      .addOrderBy('m.nome_medico', 'ASC')
      .addOrderBy('m.crm_medico', 'ASC')
      .addOrderBy('m.unidade', 'ASC');

    const totalMedicos = await qb.clone().getCount();
    if (!dto.todos) {
      qb.skip((page - 1) * limit).take(limit);
    }
    const medicos = await qb.getMany();
    return { medicos, totalMedicos };
  }

  private mapRetratoRecebidoPorUnidade(
    r: VisitacaoFechamentoRepresentante,
    unidadeFreeze: Unidade,
  ): VisitacaoAcompanhamentoRecebidoUnidadeDto[] {
    const filhos = r.unidadesRecebido ?? [];
    if (filhos.length) {
      return filhos.map((item) => ({
        unidade: item.unidade,
        valor: Number(item.valor) || 0,
        quantidade: item.quantidade ?? 0,
      }));
    }
    return [
      {
        unidade: unidadeFreeze,
        valor: Number(r.recebidoLoja) || 0,
        quantidade: r.quantidadeRecebido ?? 0,
      },
    ];
  }

  private montarSqlListagemCombinada(
    baseSql: string,
    orderSql: string,
    pagina: { limitIdx: number; offsetIdx: number } | null,
  ): string {
    const pageFilter = pagina
      ? `WHERE p._rn > $${pagina.offsetIdx} AND p._rn <= $${pagina.offsetIdx} + $${pagina.limitIdx}`
      : '';
    return `
      WITH filtered AS MATERIALIZED (
        ${baseSql}
      ),
      ranked AS (
        SELECT f.*, ROW_NUMBER() OVER (${orderSql}) AS _rn
        FROM filtered f
      ),
      recebido_rep_unidade AS (
        SELECT
          COALESCE(NULLIF(BTRIM(f.nome_representante), ''), 'Sem representante') AS nome_representante,
          f.funcionario_id,
          f.unidade,
          COALESCE(SUM(f.valor_recebido), 0) AS valor,
          COALESCE(SUM(f.qtd_recebido), 0)::int AS quantidade
        FROM filtered f
        WHERE NOT f.movimento_fora_carteira
        GROUP BY 1, 2, 3
        HAVING COALESCE(SUM(f.valor_recebido), 0) <> 0
      )
      SELECT
        COALESCE(
          (
            SELECT jsonb_agg(to_jsonb(t) ORDER BY
              CASE WHEN t.nome_representante = 'Sem representante' THEN 1 ELSE 0 END,
              t.nome_representante ASC)
            FROM (
              SELECT
                g.*,
                COALESCE(u.recebido_por_unidade, '[]'::jsonb) AS recebido_por_unidade
              FROM (
                SELECT
                  COALESCE(NULLIF(BTRIM(filtered.nome_representante), ''), 'Sem representante') AS nome_representante,
                  filtered.funcionario_id,
                  COALESCE(SUM(CASE
                    WHEN filtered.movimento_fora_carteira THEN 0
                    ELSE filtered.valor_recebido
                  END), 0) AS valor_recebido,
                  COALESCE(SUM(CASE
                    WHEN filtered.movimento_fora_carteira THEN 0
                    ELSE filtered.qtd_recebido
                  END), 0) AS qtd_recebido,
                  COALESCE(SUM(CASE
                    WHEN filtered.movimento_fora_carteira THEN filtered.valor_recebido
                    ELSE 0
                  END), 0) AS valor_recebido_outras,
                  COALESCE(SUM(CASE
                    WHEN filtered.movimento_fora_carteira THEN filtered.qtd_recebido
                    ELSE 0
                  END), 0) AS qtd_recebido_outras,
                  COALESCE(SUM(filtered.valor_rejeitado), 0) AS valor_rejeitado,
                  COALESCE(SUM(filtered.qtd_rejeitado), 0) AS qtd_rejeitado,
                  COUNT(*)::int AS qtd_medicos
                FROM filtered
                GROUP BY 1, 2
              ) g
              LEFT JOIN LATERAL (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'unidade', r.unidade,
                    'valor', r.valor,
                    'quantidade', r.quantidade
                  )
                  ORDER BY r.unidade
                ) AS recebido_por_unidade
                FROM recebido_rep_unidade r
                WHERE r.nome_representante = g.nome_representante
                  AND r.funcionario_id IS NOT DISTINCT FROM g.funcionario_id
              ) u ON TRUE
            ) t
          ),
          '[]'::jsonb
        ) AS totais_por_representante,
        COALESCE(
          (
            SELECT jsonb_agg((to_jsonb(p) - '_rn') ORDER BY p._rn)
            FROM ranked p
            ${pageFilter}
          ),
          '[]'::jsonb
        ) AS data
    `;
  }

  private montarSqlFiltrado(
    usuario: Usuario,
    dto: FindVisitacaoAcompanhamentoDto,
    filtroRep: {
      unidade: Unidade;
      contrato: number;
      codigo: number;
    } | null,
    periodo: PeriodoCompetencia,
  ): SqlBuild {
    const params: unknown[] = [periodo.dataInicial, periodo.dataFinal];
    let idx = 3;

    const escopo = resolverEscopoListaFechamentoPorUsuario(
      usuario,
      dto.unidade,
    );
    const carteira = escopo === 'ALL' ? null : escopo;
    let idxCarteira: number | null = null;
    if (carteira) {
      idxCarteira = idx;
      params.push(carteira);
      idx += 1;
    }

    const modoPainel: 'sim' | 'nao' | 'todos' =
      dto.naCarteira === 'sim'
        ? 'sim'
        : dto.naCarteira === 'nao'
          ? 'nao'
          : 'todos';

    const ordemPainelCrm = idxCarteira
      ? `CASE WHEN n.unidade = $${idxCarteira} THEN 0 ELSE 1 END,`
      : '';

    const naCarteiraExpr = idxCarteira
      ? `(pc.crm IS NOT NULL AND pc.unidade = $${idxCarteira})`
      : `(pc.crm IS NOT NULL OR pe.crm IS NOT NULL)`;
    const unidadeCarteiraExpr = idxCarteira
      ? `CASE
          WHEN pc.crm IS NOT NULL AND pc.unidade = $${idxCarteira} THEN pc.unidade
          ELSE pe.unidade
        END`
      : `COALESCE(pe.unidade, pc.unidade)`;
    const movimentoForaExpr = idxCarteira
      ? `(
          pc.crm IS NOT NULL
          AND pc.unidade = $${idxCarteira}
          AND b.unidade IS DISTINCT FROM $${idxCarteira}
          AND NOT EXISTS (
            SELECT 1
            FROM unidades_comissao uc
            WHERE uc.funcionario_id = pc.funcionario_id
              AND uc.unidade = b.unidade
          )
        )`
      : `(pe.crm IS NULL AND pc.crm IS NOT NULL)`;
    const nomeRepExpr = idxCarteira
      ? `COALESCE(
          CASE WHEN pc.unidade = $${idxCarteira} THEN pc.nome_funcionario END,
          CASE WHEN pc.unidade = $${idxCarteira} THEN pc.nome_representante_erp END,
          pe.nome_funcionario,
          pe.nome_representante_erp
        )`
      : `COALESCE(
          pe.nome_funcionario,
          pe.nome_representante_erp,
          pc.nome_funcionario,
          pc.nome_representante_erp
        )`;
    const funcionarioIdExpr = idxCarteira
      ? `COALESCE(
          CASE WHEN pc.unidade = $${idxCarteira} THEN pc.funcionario_id END,
          pe.funcionario_id
        )`
      : `COALESCE(pe.funcionario_id, pc.funcionario_id)`;

    const joinCaixaPago = `${this.sqlJoinCaixaPago()}${this.sqlJoinFormulaSerie()}`;
    const selectRecebido = `
            i.unidade,
            i.numero_cupom,
            i.numero_requisicao,
            COALESCE(NULLIF(BTRIM(f.serie), ''), '') AS serie,
            ${this.sqlCrmPrescritor()} AS crm,
            ${this.sqlUfPrescritor()} AS uf,
            ${this.sqlNomePrescritor()} AS nome_medico,
            ${this.sqlValorRecebidoPrescritorOuSerie()} AS valor_recebido`;
    const whereCaixaPeriodo = `
            i.tipo_item = 'REQUISICAO'
            AND i.numero_requisicao IS NOT NULL
            ${this.sqlFiltroPeriodoRecebido('$1', '$2')}
            ${this.sqlFiltroRecebidoVisitacao()}`;
    const recebidosCaixaCarteira = idxCarteira
      ? `
          SELECT
            i.unidade,
            i.numero_cupom,
            i.numero_requisicao,
            COALESCE(NULLIF(BTRIM(f.serie), ''), '') AS serie,
            ${this.sqlCrmPrescritor()} AS crm,
            ${this.sqlUfPrescritor()} AS uf,
            ${this.sqlNomePrescritor()} AS nome_medico,
            ${this.sqlValorRecebidoPrescritorOuSerie()} AS valor_recebido
          FROM caixa_itens_erp i
          ${joinCaixaPago}
          INNER JOIN crms_carteira cc
            ON cc.crm = ${this.sqlCrmPrescritor()}
            AND cc.uf = ${this.sqlUfPrescritor()}
          WHERE ${whereCaixaPeriodo}
            AND c.id IS NOT NULL
            AND ${this.sqlCrmPrescritor()} IS NOT NULL
            AND ${this.sqlUfPrescritor()} IS NOT NULL
            ${modoPainel === 'todos' ? `AND i.unidade IS DISTINCT FROM $${idxCarteira}` : ''}
            AND ${this.sqlIndicacaoOuUnidadeComissao(
              idxCarteira,
              'i.unidade',
              this.sqlCrmPrescritor(),
              this.sqlUfPrescritor(),
              'cc.funcionario_id',
            )}`
      : '';

    const wrapRecebidoUnico = (innerSql: string): string => `
        FROM (
          SELECT DISTINCT ON (
            g.unidade,
            g.numero_cupom,
            g.numero_requisicao,
            COALESCE(g.serie, ''),
            g.crm,
            g.uf
          )
            g.unidade,
            g.crm,
            g.uf,
            g.nome_medico,
            g.valor_recebido
          FROM (
            ${innerSql}
          ) g
          ORDER BY
            g.unidade,
            g.numero_cupom,
            g.numero_requisicao,
            COALESCE(g.serie, ''),
            g.crm,
            g.uf
        ) src`;

    let recebidosFrom: string;
    let rejeitadosExtra = '';
    if (idxCarteira && modoPainel === 'sim') {
      recebidosFrom = wrapRecebidoUnico(`
          ${recebidosCaixaCarteira}
      `);
      rejeitadosExtra = `
          AND ${this.sqlMovimentoUnidadeComissaoViaCarteira(
            idxCarteira,
            'o.unidade',
            'BTRIM(o."crmMedico")',
            'UPPER(BTRIM(o."ufcrmMedico"))',
          )}`;
    } else if (idxCarteira && modoPainel === 'nao') {
      recebidosFrom = wrapRecebidoUnico(`
          SELECT ${selectRecebido}
          FROM caixa_itens_erp i
          ${joinCaixaPago}
          WHERE ${whereCaixaPeriodo}
            AND i.unidade = $${idxCarteira}
            AND ${this.sqlCrmPrescritor()} IS NOT NULL
            AND ${this.sqlUfPrescritor()} IS NOT NULL
      `);
      rejeitadosExtra = ` AND o.unidade = $${idxCarteira}`;
    } else if (idxCarteira && modoPainel === 'todos') {
      recebidosFrom = wrapRecebidoUnico(`
          SELECT ${selectRecebido}
          FROM caixa_itens_erp i
          ${joinCaixaPago}
          WHERE ${whereCaixaPeriodo}
            AND i.unidade = $${idxCarteira}
            AND ${this.sqlCrmPrescritor()} IS NOT NULL
            AND ${this.sqlUfPrescritor()} IS NOT NULL
          UNION ALL
          ${recebidosCaixaCarteira}
      `);
      rejeitadosExtra = `
          AND (
            o.unidade = $${idxCarteira}
            OR ${this.sqlMovimentoUnidadeComissaoViaCarteira(
              idxCarteira,
              'o.unidade',
              'BTRIM(o."crmMedico")',
              'UPPER(BTRIM(o."ufcrmMedico"))',
            )}
          )`;
    } else {
      recebidosFrom = wrapRecebidoUnico(`
          SELECT ${selectRecebido}
          FROM caixa_itens_erp i
          ${joinCaixaPago}
          WHERE ${whereCaixaPeriodo}
            AND ${this.sqlCrmPrescritor()} IS NOT NULL
            AND ${this.sqlUfPrescritor()} IS NOT NULL
      `);
    }

    const crmsCte = idxCarteira
      ? `crms_carteira AS MATERIALIZED (
        SELECT DISTINCT ON (
          BTRIM(p."crmMedico"),
          UPPER(BTRIM(p."ufCrmMedico"))
        )
          BTRIM(p."crmMedico") AS crm,
          UPPER(BTRIM(p."ufCrmMedico")) AS uf,
          f.id AS funcionario_id
        FROM painel_medicos_representantes p
        LEFT JOIN funcionarios f
          ON f.unidade = p.unidade
          AND f."painelContratoRepresentante" = p."contratoRepresentante"
          AND f."painelCodigoRepresentante" = p."codigoRepresentante"
        WHERE p.unidade = $${idxCarteira}
          AND NULLIF(BTRIM(p."crmMedico"), '') IS NOT NULL
          AND NULLIF(BTRIM(p."ufCrmMedico"), '') IS NOT NULL
        ORDER BY
          BTRIM(p."crmMedico"),
          UPPER(BTRIM(p."ufCrmMedico"))
      ),
      unidades_comissao AS MATERIALIZED (
        SELECT f.id AS funcionario_id, f.unidade
        FROM funcionarios f
        WHERE f.unidade = $${idxCarteira}
          AND f."painelContratoRepresentante" IS NOT NULL
          AND f."painelContratoRepresentante" > 0
          AND f."painelCodigoRepresentante" IS NOT NULL
          AND f."painelCodigoRepresentante" > 0
        UNION
        SELECT uc."funcionarioId" AS funcionario_id, uc.unidade
        FROM visitacao_representante_unidade_comissao uc
        INNER JOIN funcionarios f ON f.id = uc."funcionarioId"
        WHERE f.unidade = $${idxCarteira}
      ),`
      : '';
    const painelUnidadeFiltro =
      idxCarteira && modoPainel === 'sim'
        ? `WHERE p.unidade = $${idxCarteira}`
        : '';

    const cte = `
      WITH ${crmsCte}
      recebidos AS (
        SELECT
          src.unidade,
          src.crm,
          src.uf,
          MAX(src.nome_medico) AS nome_medico,
          SUM(src.valor_recebido) AS valor_recebido,
          COUNT(*)::int AS qtd_recebido
        ${recebidosFrom}
        WHERE src.crm IS NOT NULL AND BTRIM(src.crm) <> ''
          AND src.uf IS NOT NULL AND BTRIM(src.uf) <> ''
        GROUP BY src.unidade, src.crm, src.uf
      ),
      rejeitados AS (
        SELECT
          o.unidade AS unidade,
          BTRIM(o."crmMedico") AS crm,
          UPPER(BTRIM(o."ufcrmMedico")) AS uf,
          MAX(o."nomeMedico") AS nome_medico,
          SUM(o."precoVenda") AS valor_rejeitado,
          COUNT(*)::int AS qtd_rejeitado
        FROM orcamentos o
        WHERE o.status = 'REJEITADO'
          AND o."crmMedico" IS NOT NULL AND BTRIM(o."crmMedico") <> ''
          AND o."ufcrmMedico" IS NOT NULL AND BTRIM(o."ufcrmMedico") <> ''
          AND o."dataOrcamento" >= $1
          AND o."dataOrcamento" <= $2
          ${rejeitadosExtra}
        GROUP BY o.unidade, BTRIM(o."crmMedico"), UPPER(BTRIM(o."ufcrmMedico"))
      ),
      base AS (
        SELECT
          COALESCE(r.unidade, j.unidade) AS unidade,
          COALESCE(r.crm, j.crm) AS crm,
          COALESCE(r.uf, j.uf) AS uf,
          COALESCE(
            NULLIF(BTRIM(r.nome_medico), ''),
            NULLIF(BTRIM(j.nome_medico), ''),
            ''
          ) AS nome_medico,
          COALESCE(r.valor_recebido, 0) AS valor_recebido,
          COALESCE(r.qtd_recebido, 0) AS qtd_recebido,
          COALESCE(j.valor_rejeitado, 0) AS valor_rejeitado,
          COALESCE(j.qtd_rejeitado, 0) AS qtd_rejeitado
        FROM recebidos r
        FULL OUTER JOIN rejeitados j
          ON r.unidade = j.unidade AND r.crm = j.crm AND r.uf = j.uf
      ),
      painel_norm AS MATERIALIZED (
        SELECT DISTINCT ON (
          p.unidade,
          BTRIM(p."crmMedico"),
          UPPER(BTRIM(p."ufCrmMedico"))
        )
          p.unidade,
          BTRIM(p."crmMedico") AS crm,
          UPPER(BTRIM(p."ufCrmMedico")) AS uf,
          p."nomeMedico" AS nome_painel,
          p."nomeRepresentante" AS nome_representante_erp,
          f.id AS funcionario_id,
          f.nome AS nome_funcionario
        FROM painel_medicos_representantes p
        LEFT JOIN funcionarios f
          ON f.unidade = p.unidade
          AND f."painelContratoRepresentante" = p."contratoRepresentante"
          AND f."painelCodigoRepresentante" = p."codigoRepresentante"
        ${painelUnidadeFiltro}
        ORDER BY
          p.unidade,
          BTRIM(p."crmMedico"),
          UPPER(BTRIM(p."ufCrmMedico")),
          p."atualizadoEm" DESC
      ),
      painel_crm AS (
        SELECT DISTINCT ON (n.crm, n.uf)
          n.unidade,
          n.crm,
          n.uf,
          n.nome_painel,
          n.nome_representante_erp,
          n.funcionario_id,
          n.nome_funcionario
        FROM painel_norm n
        ORDER BY
          n.crm,
          n.uf,
          ${ordemPainelCrm}
          n.unidade
      )
      SELECT
        b.unidade,
        COALESCE(
          NULLIF(BTRIM(b.nome_medico), ''),
          NULLIF(BTRIM(pc.nome_painel), ''),
          NULLIF(BTRIM(pe.nome_painel), ''),
          ''
        ) AS nome_medico,
        b.crm,
        b.uf,
        ${nomeRepExpr} AS nome_representante,
        ${funcionarioIdExpr} AS funcionario_id,
        ${naCarteiraExpr} AS na_carteira,
        ${unidadeCarteiraExpr} AS unidade_carteira,
        ${movimentoForaExpr} AS movimento_fora_carteira,
        b.valor_recebido,
        b.qtd_recebido,
        b.valor_rejeitado,
        b.qtd_rejeitado
      FROM base b
      LEFT JOIN painel_norm pe
        ON pe.unidade = b.unidade AND pe.crm = b.crm AND pe.uf = b.uf
      LEFT JOIN painel_crm pc
        ON pc.crm = b.crm AND pc.uf = b.uf
      WHERE 1 = 1
    `;

    const filtros: string[] = [];

    if (dto.nomeMedico?.trim()) {
      filtros.push(
        ` AND (
          COALESCE(
            NULLIF(BTRIM(b.nome_medico), ''),
            NULLIF(BTRIM(pc.nome_painel), ''),
            NULLIF(BTRIM(pe.nome_painel), ''),
            ''
          )
          ILIKE $${idx}
        )`,
      );
      params.push(`%${dto.nomeMedico.trim()}%`);
      idx += 1;
    }

    if (dto.nomesMedico?.length) {
      filtros.push(
        ` AND CONCAT(
          COALESCE(
            NULLIF(BTRIM(b.nome_medico), ''),
            NULLIF(BTRIM(pc.nome_painel), ''),
            NULLIF(BTRIM(pe.nome_painel), ''),
            'Sem médico'
          ),
          ' - ',
          b.unidade
        ) IN (${dto.nomesMedico.map((_, i) => `$${idx + i}`).join(', ')})`,
      );
      params.push(...dto.nomesMedico);
      idx += dto.nomesMedico.length;
    }

    if (dto.crmMedico?.trim()) {
      filtros.push(` AND b.crm ILIKE $${idx}`);
      params.push(`%${dto.crmMedico.trim()}%`);
      idx += 1;
    }

    if (dto.ufCrmMedico?.trim()) {
      filtros.push(` AND b.uf = $${idx}`);
      params.push(dto.ufCrmMedico.trim().toUpperCase());
      idx += 1;
    }

    if (filtroRep) {
      filtros.push(` AND EXISTS (
        SELECT 1
        FROM painel_medicos_representantes pr
        WHERE BTRIM(pr."crmMedico") = b.crm
          AND UPPER(BTRIM(pr."ufCrmMedico")) = b.uf
          AND pr.unidade = $${idx}
          AND pr."contratoRepresentante" = $${idx + 1}
          AND pr."codigoRepresentante" = $${idx + 2}
      )`);
      params.push(filtroRep.unidade, filtroRep.contrato, filtroRep.codigo);
      idx += 3;
    }

    if (idxCarteira) {
      const naPainelCarteira = `EXISTS (
        SELECT 1
        FROM crms_carteira cc
        WHERE cc.crm = b.crm AND cc.uf = b.uf
      )`;
      if (dto.naCarteira === 'nao') {
        filtros.push(
          ` AND b.unidade = $${idxCarteira} AND NOT ${naPainelCarteira}`,
        );
      } else if (dto.naCarteira === 'sim') {
        filtros.push(` AND ${naPainelCarteira}`);
      } else {
        filtros.push(
          ` AND (${naPainelCarteira} OR b.unidade = $${idxCarteira})`,
        );
      }
      filtros.push(
        ` AND ${this.sqlIndicacaoOuUnidadeComissao(
          idxCarteira,
          'b.unidade',
          'b.crm',
          'b.uf',
          funcionarioIdExpr,
        )}`,
      );
    } else if (dto.naCarteira === 'sim') {
      filtros.push(' AND (pc.crm IS NOT NULL OR pe.crm IS NOT NULL)');
    } else if (dto.naCarteira === 'nao') {
      filtros.push(' AND pc.crm IS NULL AND pe.crm IS NULL');
    }

    return { sql: cte + filtros.join(''), params };
  }

  /** Não há médico no painel da unidade do movimento (evita comissão duplicada). */
  private sqlMedicoSemPainelNaUnidade(
    unidadeExpr: string,
    crmExpr: string,
    ufExpr: string,
  ): string {
    return `NOT EXISTS (
      SELECT 1
      FROM painel_medicos_representantes p_mov
      WHERE p_mov.unidade = ${unidadeExpr}
        AND BTRIM(p_mov."crmMedico") = ${crmExpr}
        AND UPPER(BTRIM(p_mov."ufCrmMedico")) = ${ufExpr}
        AND NULLIF(BTRIM(p_mov."crmMedico"), '') IS NOT NULL
        AND NULLIF(BTRIM(p_mov."ufCrmMedico"), '') IS NOT NULL
    )`;
  }

  /**
   * Grade/card: unidade do filtro ou unidade marcada em comissão
   * na Configuração Metas (RN-VIS-008 / RN-VIS-011). Sem marcação,
   * movimento de outra filial não entra na grade.
   */
  private sqlIndicacaoOuUnidadeComissao(
    idxCarteira: number,
    unidadeExpr: string,
    _crmExpr: string,
    _ufExpr: string,
    funcionarioIdExpr: string,
  ): string {
    return `(
      ${unidadeExpr} = $${idxCarteira}
      OR (
        ${funcionarioIdExpr} IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM unidades_comissao uc
          WHERE uc.funcionario_id = ${funcionarioIdExpr}
            AND uc.unidade = ${unidadeExpr}
        )
      )
    )`;
  }

  /** Rejeitado/recebido fora da loja só se a unidade estiver na comissão do representante da carteira. */
  private sqlMovimentoUnidadeComissaoViaCarteira(
    idxCarteira: number,
    unidadeExpr: string,
    crmExpr: string,
    ufExpr: string,
  ): string {
    return `EXISTS (
      SELECT 1
      FROM crms_carteira cc
      WHERE cc.crm = ${crmExpr}
        AND cc.uf = ${ufExpr}
        AND (
          ${unidadeExpr} = $${idxCarteira}
          OR EXISTS (
            SELECT 1
            FROM unidades_comissao uc
            WHERE uc.funcionario_id = cc.funcionario_id
              AND uc.unidade = ${unidadeExpr}
          )
        )
    )`;
  }

  private montarOrderBy(dto: FindVisitacaoAcompanhamentoDto): string {
    const colunas: Record<string, string> = {
      unidade: 'f.unidade',
      nomeMedico: 'f.nome_medico',
      crmMedico: 'f.crm',
      nomeRepresentante: 'f.nome_representante',
      naCarteira: 'f.na_carteira',
      valorRecebido: 'f.valor_recebido',
      valorRejeitado: 'f.valor_rejeitado',
    };
    const coluna = colunas[dto.ordenarPor ?? 'valorRecebido'] ?? colunas.valorRecebido;
    const direcao = dto.ordem === 'asc' ? 'ASC' : 'DESC';
    return `ORDER BY ${coluna} ${direcao} NULLS LAST, f.nome_medico ASC, f.crm ASC, f.unidade ASC`;
  }

  private async resolverFiltroRepresentante(
    usuario: Usuario,
    dto: FindVisitacaoAcompanhamentoDto,
  ): Promise<
    | { unidade: Unidade; contrato: number; codigo: number }
    | 'NENHUM'
    | 'VAZIO'
  > {
    if (!dto.funcionarioId) {
      return 'NENHUM';
    }

    const funcionario = await this.funcionarioRepository.findOne({
      where: { id: dto.funcionarioId },
    });
    if (!funcionario) {
      throw new NotFoundException('Funcionário representante não encontrado.');
    }
    if (
      funcionario.painelContratoRepresentante == null ||
      funcionario.painelCodigoRepresentante == null
    ) {
      return 'VAZIO';
    }

    const escopo = resolverEscopoListaFechamentoPorUsuario(
      usuario,
      dto.unidade,
    );
    if (escopo !== 'ALL' && funcionario.unidade !== escopo) {
      return 'VAZIO';
    }

    return {
      unidade: funcionario.unidade,
      contrato: funcionario.painelContratoRepresentante,
      codigo: funcionario.painelCodigoRepresentante,
    };
  }

  private mapItem(row: RowAgregado): VisitacaoAcompanhamentoItemDto {
    const unidadeCarteira = row.unidade_carteira ?? null;
    return {
      unidade: row.unidade,
      nomeMedico: row.nome_medico || '—',
      crmMedico: row.crm,
      ufCrmMedico: row.uf,
      nomeRepresentante: row.nome_representante,
      naCarteira: row.na_carteira === true || row.na_carteira === 't' || row.na_carteira === 1,
      unidadeCarteira,
      movimentoForaCarteira:
        row.movimento_fora_carteira === true ||
        row.movimento_fora_carteira === 't' ||
        row.movimento_fora_carteira === 1,
      valorRecebido: this.toNumber(row.valor_recebido),
      quantidadeRecebido: this.toInt(row.qtd_recebido),
      valorRejeitado: this.toNumber(row.valor_rejeitado),
      quantidadeRejeitado: this.toInt(row.qtd_rejeitado),
    };
  }

  private async crmExisteNoPainel(
    unidade: Unidade,
    crm: string,
    uf: string,
  ): Promise<boolean> {
    const rows = (await this.dataSource.query(
      `
      SELECT 1
      FROM painel_medicos_representantes p
      WHERE p.unidade = $1
        AND BTRIM(p."crmMedico") = $2
        AND UPPER(BTRIM(p."ufCrmMedico")) = $3
      LIMIT 1
      `,
      [unidade, crm, uf],
    )) as Array<{ '?column?': number }>;
    return rows.length > 0;
  }

  /** Detalhe de outra filial: unidade precisa estar na comissão do representante do CRM na unidade do filtro. */
  private async crmUnidadeComissaoPermitida(
    unidadePainel: Unidade,
    unidadeMovimento: Unidade,
    crm: string,
    uf: string,
  ): Promise<boolean> {
    if (unidadePainel === unidadeMovimento) {
      return true;
    }
    const rows = (await this.dataSource.query(
      `
      SELECT 1
      FROM painel_medicos_representantes p
      INNER JOIN funcionarios f
        ON f.unidade = p.unidade
        AND f."painelContratoRepresentante" = p."contratoRepresentante"
        AND f."painelCodigoRepresentante" = p."codigoRepresentante"
      INNER JOIN visitacao_representante_unidade_comissao uc
        ON uc."funcionarioId" = f.id
        AND uc.unidade = $2
      WHERE p.unidade = $1
        AND BTRIM(p."crmMedico") = $3
        AND UPPER(BTRIM(p."ufCrmMedico")) = $4
      LIMIT 1
      `,
      [unidadePainel, unidadeMovimento, crm, uf],
    )) as Array<{ '?column?': number }>;
    return rows.length > 0;
  }

  private desempenhoBase(periodo: PeriodoCompetencia): Pick<
    VisitacaoAcompanhamentoTotaisDto,
    | 'valorMeta'
    | 'percentualMeta'
    | 'valorProjetado'
    | 'percentualProjecao'
    | 'diasUteisMes'
    | 'diasUteisDecorridos'
    | 'diasRealizados'
    | 'mesAberto'
    | 'quantidadeRepresentantes'
    | 'quantidadeComMeta'
  > {
    const hoje = ymdHojeSp();
    return {
      valorMeta: null,
      percentualMeta: null,
      valorProjetado: null,
      percentualProjecao: null,
      diasUteisMes: null,
      diasUteisDecorridos: null,
      diasRealizados: null,
      mesAberto: competenciaAberta(hoje, periodo.dataInicial, periodo.dataFinal),
      quantidadeRepresentantes: 0,
      quantidadeComMeta: 0,
    };
  }

  private mapTotais(
    row: TotaisRow | undefined,
    periodo: PeriodoCompetencia,
  ): VisitacaoAcompanhamentoTotaisDto {
    return {
      valorRecebido: this.toNumber(row?.valor_recebido),
      quantidadeRecebido: this.toInt(row?.qtd_recebido),
      valorRejeitado: this.toNumber(row?.valor_rejeitado),
      quantidadeRejeitado: this.toInt(row?.qtd_rejeitado),
      quantidadeMedicos: this.toInt(row?.qtd_medicos),
      valorRecebidoCaixa: 0,
      quantidadeRecebidoCaixa: 0,
      valorRecebidoOutrasUnidades: 0,
      quantidadeRecebidoOutrasUnidades: 0,
      valorRejeitadoLoja: 0,
      quantidadeRejeitadoLoja: 0,
      valorRejeitadoOutrasUnidades: 0,
      quantidadeRejeitadoOutrasUnidades: 0,
      outrasUnidades: [],
      quantidadeMedicosPainel: 0,
      quantidadeMedicosForaAtendimento: 0,
      ...this.desempenhoBase(periodo),
    };
  }

  private mapTotaisRepresentante(
    row: TotaisRepresentanteRow,
    periodo: PeriodoCompetencia,
  ): VisitacaoAcompanhamentoTotaisRepresentanteDto {
    const funcionarioId = row.funcionario_id?.trim() || null;
    return {
      nomeRepresentante:
        row.nome_representante?.trim() || NOME_SEM_REPRESENTANTE,
      funcionarioId,
      ...this.mapTotais(row, periodo),
      valorRecebidoOutrasUnidades: this.toNumber(row.valor_recebido_outras),
      quantidadeRecebidoOutrasUnidades: this.toInt(row.qtd_recebido_outras),
      recebidoPorUnidade: this.mapRecebidoPorUnidade(row.recebido_por_unidade),
      unidadesComissao: [],
    };
  }

  private async aplicarUnidadesComissaoNosCards(
    grupos: VisitacaoAcompanhamentoTotaisRepresentanteDto[],
  ): Promise<void> {
    const ids = [
      ...new Set(
        grupos
          .map((g) => g.funcionarioId)
          .filter((id): id is string => !!id),
      ),
    ];
    if (!ids.length) {
      return;
    }
    const [funcionarios, extras] = await Promise.all([
      this.funcionarioRepository.find({ where: { id: In(ids) } }),
      this.unidadeComissaoRepository.find({
        where: { funcionario: { id: In(ids) } },
        relations: ['funcionario'],
      }),
    ]);
    const homePorId = new Map(funcionarios.map((f) => [f.id, f.unidade]));
    const extrasPorId = new Map<string, Unidade[]>();
    for (const row of extras) {
      const fid = row.funcionario.id;
      const lista = extrasPorId.get(fid) ?? [];
      lista.push(row.unidade);
      extrasPorId.set(fid, lista);
    }
    const ordem = Object.values(Unidade);
    for (const grupo of grupos) {
      const fid = grupo.funcionarioId;
      if (!fid) continue;
      const home = homePorId.get(fid);
      if (!home) continue;
      const set = new Set<Unidade>([home, ...(extrasPorId.get(fid) ?? [])]);
      const unidades = ordem.filter((u) => set.has(u));
      grupo.unidadesComissao = unidades;
      grupo.recebidoPorUnidade = (grupo.recebidoPorUnidade ?? []).filter(
        (item) => set.has(item.unidade),
      );
    }
  }

  private mapRecebidoPorUnidade(
    value:
      | TotaisRepresentanteRow['recebido_por_unidade']
      | undefined,
  ): VisitacaoAcompanhamentoRecebidoUnidadeDto[] {
    const unidades = new Set<string>(Object.values(Unidade));
    return this.asJsonArray<{
      unidade: string;
      valor: string | number;
      quantidade: string | number;
    }>(value)
      .map((item) => {
        const unidade = String(item.unidade ?? '').trim();
        if (!unidades.has(unidade)) {
          return null;
        }
        return {
          unidade: unidade as Unidade,
          valor: this.toNumber(item.valor),
          quantidade: this.toInt(item.quantidade),
        };
      })
      .filter((item): item is VisitacaoAcompanhamentoRecebidoUnidadeDto => {
        return item != null && item.valor !== 0;
      })
      .sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR'));
  }

  private somarTotais(
    grupos: VisitacaoAcompanhamentoTotaisRepresentanteDto[],
    periodo: PeriodoCompetencia,
  ): VisitacaoAcompanhamentoTotaisDto {
    const acc = grupos.reduce(
      (atual, grupo) => ({
        valorRecebido: atual.valorRecebido + grupo.valorRecebido,
        quantidadeRecebido: atual.quantidadeRecebido + grupo.quantidadeRecebido,
        valorRejeitado: atual.valorRejeitado + grupo.valorRejeitado,
        quantidadeRejeitado:
          atual.quantidadeRejeitado + grupo.quantidadeRejeitado,
        quantidadeMedicos: atual.quantidadeMedicos + grupo.quantidadeMedicos,
        valorRecebidoCaixa: 0,
        quantidadeRecebidoCaixa: 0,
        valorRecebidoOutrasUnidades: 0,
        quantidadeRecebidoOutrasUnidades: 0,
        valorRejeitadoLoja: 0,
        quantidadeRejeitadoLoja: 0,
        valorRejeitadoOutrasUnidades: 0,
        quantidadeRejeitadoOutrasUnidades: 0,
        quantidadeMedicosPainel: 0,
        quantidadeMedicosForaAtendimento: 0,
      }),
      {
        valorRecebido: 0,
        quantidadeRecebido: 0,
        valorRejeitado: 0,
        quantidadeRejeitado: 0,
        quantidadeMedicos: 0,
        valorRecebidoCaixa: 0,
        quantidadeRecebidoCaixa: 0,
        valorRecebidoOutrasUnidades: 0,
        quantidadeRecebidoOutrasUnidades: 0,
        valorRejeitadoLoja: 0,
        quantidadeRejeitadoLoja: 0,
        valorRejeitadoOutrasUnidades: 0,
        quantidadeRejeitadoOutrasUnidades: 0,
        quantidadeMedicosPainel: 0,
        quantidadeMedicosForaAtendimento: 0,
      },
    );
    return { ...acc, ...this.desempenhoBase(periodo) };
  }

  private async anexarDesempenho(
    grupos: VisitacaoAcompanhamentoTotaisRepresentanteDto[],
    totais: VisitacaoAcompanhamentoTotaisDto,
    periodo: PeriodoCompetencia,
    unidadeFiltro: Unidade | null,
    exporComissao: boolean,
  ): Promise<void> {
    const ids = [
      ...new Set(
        grupos
          .map((g) => g.funcionarioId)
          .filter((id): id is string => !!id),
      ),
    ];
    const hoje = ymdHojeSp();
    const mesAberto = competenciaAberta(
      hoje,
      periodo.dataInicial,
      periodo.dataFinal,
    );
    totais.mesAberto = mesAberto;
    for (const g of grupos) {
      g.mesAberto = mesAberto;
    }

    const funcionarios = ids.length
      ? await this.funcionarioRepository.find({ where: { id: In(ids) } })
      : [];
    const metas = ids.length
      ? await this.metaRepository
          .createQueryBuilder('m')
          .innerJoinAndSelect('m.funcionario', 'func')
          .where('m.anoMes = :anoMes', { anoMes: periodo.anoMes })
          .andWhere('func.id IN (:...ids)', { ids })
          .getMany()
      : [];
    const funcPorId = new Map(funcionarios.map((f) => [f.id, f]));
    const metaPorFunc = new Map<string, number>();
    for (const m of metas) {
      const fid = m.funcionario?.id;
      if (fid && m.valorMeta > 0) {
        metaPorFunc.set(fid, Number(m.valorMeta));
      }
    }
    const unidades = new Set<Unidade>();
    for (const f of funcionarios) {
      unidades.add(f.unidade);
    }
    if (unidadeFiltro) {
      unidades.add(unidadeFiltro);
    }
    const unidadesList = [...unidades];
    const [calendarios, feriadosRows, caixasFechados] = await Promise.all([
      unidadesList.length
        ? this.calendarioRepository.find({
            where: { unidade: In(unidadesList) },
          })
        : Promise.resolve([]),
      unidadesList.length
        ? this.feriadoRepository
            .createQueryBuilder('f')
            .where('f.unidade IN (:...unidades)', { unidades: unidadesList })
            .andWhere('f.data >= :ini AND f.data <= :fim', {
              ini: periodo.dataInicial,
              fim: periodo.dataFinal,
            })
            .getMany()
        : Promise.resolve([]),
      unidadesList.length
        ? this.caixaFechamentoRepository
            .createQueryBuilder('c')
            .select('c.unidade', 'unidade')
            .addSelect("MAX(TO_CHAR(c.dataOperacao, 'YYYY-MM-DD'))", 'ultima')
            .where('c.status = :status', {
              status: CaixaFechamentoStatus.CONFIRMADO,
            })
            .andWhere('c.unidade IN (:...unidades)', { unidades: unidadesList })
            .groupBy('c.unidade')
            .getRawMany<{ unidade: Unidade; ultima: string }>()
        : Promise.resolve([]),
    ]);
    const sabadoPorUnidade = new Map<Unidade, boolean>();
    for (const c of calendarios) {
      sabadoPorUnidade.set(c.unidade, c.sabadoDiaUtil);
    }
    const feriadosPorUnidade = new Map<Unidade, Set<string>>();
    for (const u of unidadesList) {
      feriadosPorUnidade.set(u, new Set());
    }
    for (const f of feriadosRows) {
      feriadosPorUnidade.get(f.unidade)?.add(f.data);
    }
    const ultimaConfirmadaPorUnidade = new Map<Unidade, string>();
    for (const row of caixasFechados) {
      if (row.unidade && row.ultima) {
        ultimaConfirmadaPorUnidade.set(row.unidade, row.ultima);
      }
    }

    const duDe = (unidade: Unidade, ate: string): number => {
      const sabado = sabadoPorUnidade.get(unidade) ?? false;
      const feriados = feriadosPorUnidade.get(unidade) ?? new Set<string>();
      return somarDiasUteisVisitacao(
        periodo.dataInicial,
        ate,
        sabado,
        feriados,
      );
    };
    const realizadosDe = (unidade: Unidade): number => {
      const sabado = sabadoPorUnidade.get(unidade) ?? false;
      const feriados = feriadosPorUnidade.get(unidade) ?? new Set<string>();
      return somarDiasRealizadosVisitacao(
        periodo.dataInicial,
        periodo.dataFinal,
        ultimaConfirmadaPorUnidade.get(unidade) ?? null,
        sabado,
        feriados,
      );
    };

    for (const grupo of grupos) {
      const fid = grupo.funcionarioId;
      if (!fid) continue;
      const meta = metaPorFunc.get(fid);
      if (meta != null) {
        grupo.valorMeta = meta;
        grupo.percentualMeta =
          meta > 0 ? (grupo.valorRecebido / meta) * 100 : null;
        grupo.quantidadeRepresentantes = 1;
        grupo.quantidadeComMeta = 1;
      } else {
        grupo.quantidadeRepresentantes = 1;
        grupo.quantidadeComMeta = 0;
      }
      const unidadeRep = funcPorId.get(fid)?.unidade;
      if (!unidadeRep) continue;
      const duMes = duDe(unidadeRep, periodo.dataFinal);
      const duDec = mesAberto ? duDe(unidadeRep, hoje) : duMes;
      const realizados = realizadosDe(unidadeRep);
      grupo.diasUteisMes = duMes;
      grupo.diasUteisDecorridos = duDec;
      grupo.diasRealizados = realizados;
      if (mesAberto && realizados > 0) {
        grupo.valorProjetado = this.round2(
          (grupo.valorRecebido / realizados) * duMes,
        );
        if (meta != null && meta > 0) {
          grupo.percentualProjecao =
            (grupo.valorProjetado / meta) * 100;
        }
      }
    }

    if (exporComissao && ids.length) {
      const faixas = await this.faixaRepository
        .createQueryBuilder('faixa')
        .innerJoinAndSelect('faixa.funcionario', 'func')
        .where('func.id IN (:...ids)', { ids })
        .orderBy('faixa.percentualMetaDe', 'ASC')
        .getMany();
      const faixasPorFunc = new Map<string, VisitacaoComissaoFaixa[]>();
      for (const faixa of faixas) {
        const fid = faixa.funcionario?.id;
        if (!fid) continue;
        const lista = faixasPorFunc.get(fid) ?? [];
        lista.push(faixa);
        faixasPorFunc.set(fid, lista);
      }
      for (const grupo of grupos) {
        const fid = grupo.funcionarioId;
        if (!fid) continue;
        const lista = faixasPorFunc.get(fid) ?? [];
        if (grupo.percentualMeta != null) {
          const faixa = this.resolverFaixaComissao(lista, grupo.percentualMeta);
          if (faixa) {
            grupo.percentualComissaoFaixa = Number(faixa.percentualComissao);
            grupo.valorComissao = this.round2(
              (grupo.valorRecebido * grupo.percentualComissaoFaixa) / 100,
            );
          }
        }
        if (grupo.percentualProjecao != null && grupo.valorProjetado != null) {
          const faixaProj = this.resolverFaixaComissao(
            lista,
            grupo.percentualProjecao,
          );
          if (faixaProj) {
            grupo.percentualComissaoFaixaProjetada = Number(
              faixaProj.percentualComissao,
            );
            grupo.valorComissaoProjetado = this.round2(
              (grupo.valorProjetado * grupo.percentualComissaoFaixaProjetada) /
                100,
            );
          }
        }
      }
    }

    const vinculados = grupos.filter((g) => g.funcionarioId);
    const comMeta = vinculados.filter(
      (g) => g.valorMeta != null && g.valorMeta > 0,
    );
    totais.quantidadeRepresentantes = vinculados.length;
    totais.quantidadeComMeta = comMeta.length;
    const somaMeta = comMeta.reduce((s, g) => s + (g.valorMeta ?? 0), 0);
    totais.valorMeta = comMeta.length ? somaMeta : null;
    totais.percentualMeta =
      somaMeta > 0 ? (totais.valorRecebido / somaMeta) * 100 : null;

    const unidadesVinculo = [
      ...new Set(
        vinculados
          .map((g) => funcPorId.get(g.funcionarioId ?? '')?.unidade)
          .filter((u): u is Unidade => !!u),
      ),
    ];
    const unidadeCalendario =
      unidadeFiltro ??
      (unidadesVinculo.length === 1 ? unidadesVinculo[0] : null) ??
      unidadesList[0] ??
      null;
    if (unidadeCalendario) {
      const duMes = duDe(unidadeCalendario, periodo.dataFinal);
      const duDec = mesAberto ? duDe(unidadeCalendario, hoje) : duMes;
      const realizados = realizadosDe(unidadeCalendario);
      totais.diasUteisMes = duMes;
      totais.diasUteisDecorridos = duDec;
      totais.diasRealizados = realizados;
      if (mesAberto && realizados > 0) {
        totais.valorProjetado = this.round2(
          (totais.valorRecebido / realizados) * duMes,
        );
        if (totais.valorMeta != null && totais.valorMeta > 0) {
          totais.percentualProjecao =
            (totais.valorProjetado / totais.valorMeta) * 100;
        }
      }
    } else {
      const comDu = grupos.find((g) => g.diasUteisMes != null);
      if (comDu?.diasUteisMes != null) {
        totais.diasUteisMes = comDu.diasUteisMes;
        totais.diasUteisDecorridos = comDu.diasUteisDecorridos ?? null;
        totais.diasRealizados = comDu.diasRealizados ?? null;
      }
    }
  }

  private resolverFaixaComissao(
    faixas: VisitacaoComissaoFaixa[],
    percentualMeta: number,
  ): VisitacaoComissaoFaixa | null {
    const ordenadas = [...faixas].sort(
      (a, b) => Number(a.percentualMetaDe) - Number(b.percentualMetaDe),
    );
    for (const faixa of ordenadas) {
      const de = Number(faixa.percentualMetaDe);
      const ate =
        faixa.percentualMetaAte == null ? null : Number(faixa.percentualMetaAte);
      if (percentualMeta + 1e-9 < de) continue;
      if (ate != null && percentualMeta - 1e-9 > ate) continue;
      return faixa;
    }
    return null;
  }

  private async consultarRecebidoCaixa(
    escopo: ListaFechamentoEscopo,
    periodo: PeriodoCompetencia,
  ): Promise<{ valor: number; quantidade: number }> {
    const params: unknown[] = [periodo.dataInicial, periodo.dataFinal];
    const join = this.sqlJoinCaixaPago();
    const valor = this.sqlValorRecebidoPrescritor();
    const where = `
            i.tipo_item = 'REQUISICAO'
            AND i.numero_requisicao IS NOT NULL
            ${this.sqlFiltroPeriodoRecebido('$1', '$2')}
            ${this.sqlFiltroRecebidoVisitacao()}`;

    let inner: string;
    if (escopo === 'ALL') {
      inner = `
          SELECT
            i.unidade,
            i.numero_cupom,
            i.numero_requisicao,
            ${valor} AS valor_recebido
          FROM caixa_itens_erp i
          ${join}
          WHERE ${where}`;
    } else {
      params.push(escopo);
      inner = `
          SELECT
            i.unidade,
            i.numero_cupom,
            i.numero_requisicao,
            ${valor} AS valor_recebido
          FROM caixa_itens_erp i
          ${join}
          WHERE ${where}
            AND i.unidade = $3`;
    }

    const sql = `
      SELECT
        COALESCE(SUM(t.valor_recebido), 0) AS valor,
        COUNT(*)::int AS qtd
      FROM (
        SELECT DISTINCT ON (g.unidade, g.numero_cupom, g.numero_requisicao)
          g.valor_recebido
        FROM (
          ${inner}
        ) g
        ORDER BY g.unidade, g.numero_cupom, g.numero_requisicao
      ) t
    `;
    const rows = (await this.dataSource.query(sql, params)) as Array<{
      valor: string | number | null;
      qtd: string | number | null;
    }>;
    return {
      valor: this.round2(this.toNumber(rows[0]?.valor)),
      quantidade: this.toInt(rows[0]?.qtd),
    };
  }

  private async consultarRejeitadoLoja(
    escopo: ListaFechamentoEscopo,
    periodo: PeriodoCompetencia,
  ): Promise<{ valor: number; quantidade: number }> {
    const params: unknown[] = [periodo.dataInicial, periodo.dataFinal];
    const filtroUnidade =
      escopo === 'ALL' ? '' : 'AND o.unidade = $3';
    if (escopo !== 'ALL') {
      params.push(escopo);
    }
    const sql = `
      SELECT
        COALESCE(SUM(o."precoVenda"), 0) AS valor,
        COUNT(*)::int AS qtd
      FROM orcamentos o
      WHERE o.status = 'REJEITADO'
        AND o."crmMedico" IS NOT NULL AND BTRIM(o."crmMedico") <> ''
        AND o."ufcrmMedico" IS NOT NULL AND BTRIM(o."ufcrmMedico") <> ''
        AND o."dataOrcamento" >= $1
        AND o."dataOrcamento" <= $2
        ${filtroUnidade}
    `;
    const rows = (await this.dataSource.query(sql, params)) as Array<{
      valor: string | number | null;
      qtd: string | number | null;
    }>;
    return {
      valor: this.round2(this.toNumber(rows[0]?.valor)),
      quantidade: this.toInt(rows[0]?.qtd),
    };
  }

  /**
   * Card TOTAL — outras filiais: só unidades marcadas na Configuração Metas
   * de algum representante da unidade do filtro (RN-VIS-010 / RN-VIS-011).
   */
  private async consultarIndicacaoOutrasUnidades(
    unidade: Unidade,
    periodo: PeriodoCompetencia,
    extrasJaResolvidas?: Unidade[],
  ): Promise<{
    recebido: { valor: number; quantidade: number };
    rejeitado: { valor: number; quantidade: number };
    porUnidade: VisitacaoAcompanhamentoOutraUnidadeDto[];
  }> {
    const extras =
      extrasJaResolvidas ?? (await this.listarUnidadesComissaoExtras(unidade));
    if (!extras.length) {
      return { ...INDICACAO_VAZIA, porUnidade: [] };
    }

    const params: unknown[] = [
      periodo.dataInicial,
      periodo.dataFinal,
      unidade,
      extras,
    ];
    const join = `${this.sqlJoinCaixaPago()}${this.sqlJoinFormulaSerie()}`;
    const valor = this.sqlValorRecebidoPrescritorOuSerie();
    const crm = this.sqlCrmPrescritor();
    const uf = this.sqlUfPrescritor();
    const where = `
            i.tipo_item = 'REQUISICAO'
            AND i.numero_requisicao IS NOT NULL
            ${this.sqlFiltroPeriodoRecebido('$1', '$2')}
            ${this.sqlFiltroRecebidoVisitacao()}`;
    const sqlRecebido = `
      WITH crms_carteira AS MATERIALIZED (
        SELECT DISTINCT
          BTRIM(p."crmMedico") AS crm,
          UPPER(BTRIM(p."ufCrmMedico")) AS uf
        FROM painel_medicos_representantes p
        WHERE p.unidade = $3
          AND NULLIF(BTRIM(p."crmMedico"), '') IS NOT NULL
          AND NULLIF(BTRIM(p."ufCrmMedico"), '') IS NOT NULL
      )
      SELECT
        t.unidade,
        COALESCE(SUM(t.valor_recebido), 0) AS valor,
        COUNT(*)::int AS qtd
      FROM (
        SELECT DISTINCT ON (
          g.unidade,
          g.numero_cupom,
          g.numero_requisicao,
          COALESCE(g.serie, '')
        )
          g.unidade,
          g.valor_recebido
        FROM (
          SELECT
            i.unidade,
            i.numero_cupom,
            i.numero_requisicao,
            COALESCE(NULLIF(BTRIM(f.serie), ''), '') AS serie,
            ${valor} AS valor_recebido
          FROM caixa_itens_erp i
          ${join}
          INNER JOIN crms_carteira cc
            ON cc.crm = ${crm}
            AND cc.uf = ${uf}
          WHERE ${where}
            AND ${crm} IS NOT NULL
            AND ${uf} IS NOT NULL
            AND i.unidade = ANY($4)
        ) g
        ORDER BY
          g.unidade,
          g.numero_cupom,
          g.numero_requisicao,
          COALESCE(g.serie, '')
      ) t
      GROUP BY t.unidade
    `;
    const sqlRejeitado = `
      WITH crms_carteira AS MATERIALIZED (
        SELECT DISTINCT
          BTRIM(p."crmMedico") AS crm,
          UPPER(BTRIM(p."ufCrmMedico")) AS uf
        FROM painel_medicos_representantes p
        WHERE p.unidade = $3
          AND NULLIF(BTRIM(p."crmMedico"), '') IS NOT NULL
          AND NULLIF(BTRIM(p."ufCrmMedico"), '') IS NOT NULL
      )
      SELECT
        o.unidade,
        COALESCE(SUM(o."precoVenda"), 0) AS valor,
        COUNT(*)::int AS qtd
      FROM orcamentos o
      INNER JOIN crms_carteira cc
        ON cc.crm = BTRIM(o."crmMedico")
        AND cc.uf = UPPER(BTRIM(o."ufcrmMedico"))
      WHERE o.status = 'REJEITADO'
        AND o."crmMedico" IS NOT NULL AND BTRIM(o."crmMedico") <> ''
        AND o."ufcrmMedico" IS NOT NULL AND BTRIM(o."ufcrmMedico") <> ''
        AND o."dataOrcamento" >= $1
        AND o."dataOrcamento" <= $2
        AND o.unidade = ANY($4)
      GROUP BY o.unidade
    `;
    const [recRows, rejRows] = await Promise.all([
      this.dataSource.query(sqlRecebido, params) as Promise<
        Array<{
          unidade: string;
          valor: string | number | null;
          qtd: string | number | null;
        }>
      >,
      this.dataSource.query(sqlRejeitado, params) as Promise<
        Array<{
          unidade: string;
          valor: string | number | null;
          qtd: string | number | null;
        }>
      >,
    ]);

    const porUnidadeMap = new Map<string, VisitacaoAcompanhamentoOutraUnidadeDto>();
    const garantir = (raw: string): VisitacaoAcompanhamentoOutraUnidadeDto => {
      const atual = porUnidadeMap.get(raw) ?? {
        unidade: raw as Unidade,
        valorRecebido: 0,
        quantidadeRecebido: 0,
        valorRejeitado: 0,
        quantidadeRejeitado: 0,
      };
      porUnidadeMap.set(raw, atual);
      return atual;
    };
    for (const row of recRows) {
      const unidadeRow = String(row.unidade ?? '').trim();
      if (!unidadeRow) continue;
      const item = garantir(unidadeRow);
      item.valorRecebido = this.round2(this.toNumber(row.valor));
      item.quantidadeRecebido = this.toInt(row.qtd);
    }
    for (const row of rejRows) {
      const unidadeRow = String(row.unidade ?? '').trim();
      if (!unidadeRow) continue;
      const item = garantir(unidadeRow);
      item.valorRejeitado = this.round2(this.toNumber(row.valor));
      item.quantidadeRejeitado = this.toInt(row.qtd);
    }

    const ordem = Object.values(Unidade);
    const porUnidade = ordem
      .map((u) => porUnidadeMap.get(u))
      .filter((item): item is VisitacaoAcompanhamentoOutraUnidadeDto => {
        return (
          item != null &&
          (item.valorRecebido !== 0 || item.valorRejeitado !== 0)
        );
      });

    return {
      recebido: {
        valor: this.round2(
          porUnidade.reduce((s, i) => s + i.valorRecebido, 0),
        ),
        quantidade: porUnidade.reduce((s, i) => s + i.quantidadeRecebido, 0),
      },
      rejeitado: {
        valor: this.round2(
          porUnidade.reduce((s, i) => s + i.valorRejeitado, 0),
        ),
        quantidade: porUnidade.reduce((s, i) => s + i.quantidadeRejeitado, 0),
      },
      porUnidade,
    };
  }

  /** Filiais extras marcadas na meta dos representantes da unidade do filtro. */
  private async listarUnidadesComissaoExtras(
    unidadeHome: Unidade,
  ): Promise<Unidade[]> {
    const rows = await this.unidadeComissaoRepository
      .createQueryBuilder('uc')
      .innerJoin('uc.funcionario', 'f')
      .select('uc.unidade', 'unidade')
      .distinct(true)
      .where('f.unidade = :unidadeHome', { unidadeHome })
      .andWhere('uc.unidade <> :unidadeHome', { unidadeHome })
      .getRawMany<{ unidade: Unidade }>();
    const set = new Set(
      rows.map((row) => row.unidade).filter((u): u is Unidade => !!u),
    );
    return Object.values(Unidade).filter((u) => set.has(u));
  }

  private async anexarEstatisticasPainel(
    grupos: VisitacaoAcompanhamentoTotaisRepresentanteDto[],
    totais: VisitacaoAcompanhamentoTotaisDto,
    periodo: PeriodoCompetencia,
    unidadePainel: Unidade | null,
    unidadesExtras: Unidade[] = [],
  ): Promise<void> {
    const params: unknown[] = [periodo.dataInicial, periodo.dataFinal];
    const filtroUnidade = unidadePainel
      ? `AND p.unidade = $3`
      : '';
    if (unidadePainel) {
      params.push(unidadePainel);
    }
    const unidadesMovimento = unidadePainel
      ? [...new Set([unidadePainel, ...unidadesExtras])]
      : [];
    const filtroMovimento = unidadesMovimento.length
      ? `AND i.unidade = ANY($${params.length + 1})`
      : '';
    const filtroOrcamento = unidadesMovimento.length
      ? `AND o.unidade = ANY($${params.length + 1})`
      : '';
    if (unidadesMovimento.length) {
      params.push(unidadesMovimento);
    }

    const sql = `
      WITH mov AS (
        SELECT DISTINCT crm, uf FROM (
          SELECT
            ${this.sqlCrmPrescritor()} AS crm,
            ${this.sqlUfPrescritor()} AS uf
          FROM caixa_itens_erp i
          ${this.sqlJoinCaixaPago()}
          ${this.sqlJoinFormulaSerie()}
          WHERE i.tipo_item = 'REQUISICAO'
            AND i.numero_requisicao IS NOT NULL
            ${this.sqlFiltroPeriodoRecebido('$1', '$2')}
            ${this.sqlFiltroRecebidoVisitacao()}
            AND ${this.sqlCrmPrescritor()} IS NOT NULL
            AND ${this.sqlUfPrescritor()} IS NOT NULL
            ${filtroMovimento}
          UNION
          SELECT
            BTRIM(o."crmMedico") AS crm,
            UPPER(BTRIM(o."ufcrmMedico")) AS uf
          FROM orcamentos o
          WHERE o.status = 'REJEITADO'
            AND o."crmMedico" IS NOT NULL AND BTRIM(o."crmMedico") <> ''
            AND o."ufcrmMedico" IS NOT NULL AND BTRIM(o."ufcrmMedico") <> ''
            AND o."dataOrcamento" >= $1
            AND o."dataOrcamento" <= $2
            ${filtroOrcamento}
        ) x
        WHERE NULLIF(BTRIM(crm), '') IS NOT NULL
          AND NULLIF(BTRIM(uf), '') IS NOT NULL
      ),
      painel AS (
        SELECT DISTINCT
          p.unidade,
          BTRIM(p."crmMedico") AS crm,
          UPPER(BTRIM(p."ufCrmMedico")) AS uf,
          p."contratoRepresentante" AS contrato,
          p."codigoRepresentante" AS codigo
        FROM painel_medicos_representantes p
        WHERE NULLIF(BTRIM(p."crmMedico"), '') IS NOT NULL
          AND NULLIF(BTRIM(p."ufCrmMedico"), '') IS NOT NULL
          ${filtroUnidade}
      )
      SELECT
        f.id AS funcionario_id,
        COUNT(*)::int AS ativos,
        COUNT(*) FILTER (WHERE m.crm IS NULL)::int AS fora
      FROM painel p
      INNER JOIN funcionarios f
        ON f.unidade = p.unidade
        AND f."painelContratoRepresentante" = p.contrato
        AND f."painelCodigoRepresentante" = p.codigo
      LEFT JOIN mov m ON m.crm = p.crm AND m.uf = p.uf
      GROUP BY f.id
      UNION ALL
      SELECT
        NULL::uuid AS funcionario_id,
        COUNT(*)::int AS ativos,
        COUNT(*) FILTER (WHERE m.crm IS NULL)::int AS fora
      FROM painel p
      LEFT JOIN mov m ON m.crm = p.crm AND m.uf = p.uf
    `;

    const rows = (await this.dataSource.query(sql, params)) as Array<{
      funcionario_id: string | null;
      ativos: string | number | null;
      fora: string | number | null;
    }>;

    const porFunc = new Map<string, { ativos: number; fora: number }>();
    for (const row of rows) {
      const ativos = this.toInt(row.ativos);
      const fora = this.toInt(row.fora);
      if (!row.funcionario_id) {
        totais.quantidadeMedicosPainel = ativos;
        totais.quantidadeMedicosForaAtendimento = fora;
        continue;
      }
      porFunc.set(row.funcionario_id, { ativos, fora });
    }
    for (const grupo of grupos) {
      const fid = grupo.funcionarioId;
      if (!fid) continue;
      const stats = porFunc.get(fid);
      grupo.quantidadeMedicosPainel = stats?.ativos ?? 0;
      grupo.quantidadeMedicosForaAtendimento = stats?.fora ?? 0;
    }
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private respostaVazia(
    page: number,
    limit: number,
    periodo: PeriodoCompetencia,
    status?: StatusCompetenciaVisitacao,
  ): VisitacaoAcompanhamentoListResponseDto {
    const statusPadrao: StatusCompetenciaVisitacao = status ?? {
      competenciaStatus: 'ABERTO',
      dataUltimoDiaUtil: null,
      caixaUltimoDiaUtilConfirmado: false,
      podeFechar: false,
      podeReabrir: false,
      mensagemGate: null,
      fechamento: null,
    };
    return {
      data: [],
      meta: new PaginationMetaDto(page, limit, 0),
      totais: {
        valorRecebido: 0,
        quantidadeRecebido: 0,
        valorRejeitado: 0,
        quantidadeRejeitado: 0,
        quantidadeMedicos: 0,
        valorRecebidoCaixa: 0,
        quantidadeRecebidoCaixa: 0,
        valorRecebidoOutrasUnidades: 0,
        quantidadeRecebidoOutrasUnidades: 0,
        valorRejeitadoLoja: 0,
        quantidadeRejeitadoLoja: 0,
        valorRejeitadoOutrasUnidades: 0,
        quantidadeRejeitadoOutrasUnidades: 0,
        outrasUnidades: [],
        quantidadeMedicosPainel: 0,
        quantidadeMedicosForaAtendimento: 0,
        ...this.desempenhoBase(periodo),
      },
      totaisPorRepresentante: [],
      ...this.camposStatusDto(statusPadrao),
    };
  }

  private assertPeriodo(dataInicial: string, dataFinal: string): void {
    if (dataInicial > dataFinal) {
      throw new BadRequestException(
        'A data inicial não pode ser posterior à data final.',
      );
    }
  }

  private asJsonArray<T>(value: T[] | string | null | undefined): T[] {
    if (value == null) return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as T[];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(value) ? value : [];
  }

  private sqlJoinFormulaSerie(): string {
    return `
          LEFT JOIN caixa_requisicao_formula f
            ON f.requisicao_paga_id = c.id`;
  }

  /** CRM do crédito: série FC12100, senão paga FC17000. Sem orçamento (RN-VIS-008). */
  private sqlCrmPrescritor(): string {
    return `COALESCE(NULLIF(BTRIM(f.crm_medico), ''), NULLIF(BTRIM(c.crm_medico), ''))`;
  }

  private sqlUfPrescritor(): string {
    return `COALESCE(NULLIF(UPPER(BTRIM(f.uf_crm_medico)), ''), NULLIF(UPPER(BTRIM(c.uf_crm_medico)), ''))`;
  }

  private sqlNomePrescritor(): string {
    return `COALESCE(NULLIF(BTRIM(f.nome_medico), ''), NULLIF(BTRIM(c.nome_medico), ''))`;
  }

  private sqlValorRecebidoPrescritorOuSerie(): string {
    const legado = this.sqlValorRecebidoPrescritor();
    return `CASE
      WHEN f.id IS NOT NULL THEN
        CASE
          WHEN c.valor_pago_requisicao IS NOT NULL
           AND COALESCE(i.valor_liquido_item, 0) > 0
           AND i.valor_liquido_item < c.valor_pago_requisicao
           AND COALESCE(c.valor_pago_requisicao, 0) > 0
          THEN ROUND(
            (f.valor_rateado * i.valor_liquido_item
              / c.valor_pago_requisicao)::numeric,
            2
          )
          ELSE f.valor_rateado
        END
      ELSE ${legado}
    END`;
  }

  private sqlJoinCaixaPago(): string {
    return `
          LEFT JOIN LATERAL (
            SELECT c0.*
            FROM caixa_requisicoes_pagas c0
            WHERE c0.unidade = i.unidade
              AND c0.numero_requisicao = i.numero_requisicao
            ORDER BY
              CASE WHEN c0.numero_cupom = i.numero_cupom THEN 0 ELSE 1 END,
              c0.data_pagamento DESC
            LIMIT 1
          ) c ON TRUE`;
  }

  private sqlValorBaseCupomPrescritor(): string {
    return `CASE
      WHEN c.valor_pago_requisicao IS NOT NULL
       AND COALESCE(i.valor_liquido_item, 0) > 0
       AND i.valor_liquido_item < c.valor_pago_requisicao
      THEN i.valor_liquido_item
      ELSE COALESCE(c.valor_pago_requisicao, i.valor_liquido_item)
    END`;
  }

  private sqlValorFormulasPrescritor(): string {
    return `CASE
      WHEN c.valor_formulas IS NOT NULL
       AND c.valor_formulas > 0
       AND COALESCE(c.valor_pago_requisicao, 0) > COALESCE(c.valor_requisicao_bruto, 0)
       AND COALESCE(c.valor_requisicao_bruto, 0) > 0
      THEN ROUND(
        (c.valor_formulas * c.valor_requisicao_bruto
          / c.valor_pago_requisicao)::numeric,
        2
      )
      ELSE c.valor_formulas
    END`;
  }

  private sqlValorRecebidoPrescritor(): string {
    const base = this.sqlValorBaseCupomPrescritor();
    const formulas = this.sqlValorFormulasPrescritor();
    return `CASE
      WHEN (${formulas}) IS NOT NULL
       AND (${formulas}) > 0
       AND (${base}) > (${formulas})
      THEN ${formulas}
      ELSE ${base}
    END`;
  }

  private sqlFiltroPeriodoRecebido(inicio: string, fim: string): string {
    return `AND (
              (
                c.data_pagamento IS NOT NULL
                AND c.data_pagamento >= ${inicio}
                AND c.data_pagamento <= ${fim}
              )
              OR (
                c.data_pagamento IS NULL
                AND i.data_operacao >= ${inicio}
                AND i.data_operacao <= ${fim}
              )
            )`;
  }

  private sqlFiltroRecebidoVisitacao(): string {
    return `AND COALESCE(c.tipo_requisicao, '') <> 'C'
            AND (
              COALESCE(c.tipo_requisicao, '') <> ''
              OR COALESCE(i.valor_liquido_linha, 0) <> 0
            )
            AND NOT (
              COALESCE(c.tipo_requisicao, '') = 'N'
              AND COALESCE(c.valor_formulas, 0) = 0
            )`;
  }

  private toNumber(value: string | number | null | undefined): number {
    if (value == null || value === '') return 0;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private toInt(value: string | number | null | undefined): number {
    return Math.trunc(this.toNumber(value));
  }
}

