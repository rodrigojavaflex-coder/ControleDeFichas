import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
import { VisitacaoPainelMedicoRepresentanteDto } from '../visitacao-painel-medico/dto/visitacao-painel-medico-representante.dto';
import { VisitacaoAcompanhamentoOpcoesFiltroDto } from './dto/visitacao-acompanhamento-opcoes-filtro.dto';
import { VisitacaoMetaRepresentante } from '../visitacao-meta/entities/visitacao-meta-representante.entity';
import { VisitacaoComissaoFaixa } from '../visitacao-meta/entities/visitacao-comissao-faixa.entity';
import { CalendarioUnidade } from '../producao-config/entities/calendario-unidade.entity';
import { ProducaoFeriado } from '../producao-config/entities/producao-feriado.entity';
import { CaixaFechamento } from '../fechamento-caixa/entities/caixa-fechamento.entity';
import { CaixaFechamentoStatus } from '../fechamento-caixa/enums/caixa-fechamento-status.enum';
import { Permission } from '../../common/enums/permission.enum';
import { getUsuarioPermissoes } from '../../common/utils/usuario-permissoes.util';
import {
  competenciaAberta,
  PeriodoCompetencia,
  periodoCompetencia,
  somarDiasUteisVisitacao,
  somarDiasRealizadosVisitacao,
  ymdHojeSp,
} from './utils/visitacao-dias-uteis.util';

const NOME_SEM_REPRESENTANTE = 'Sem representante';

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
};

type RecebidoRow = {
  data_pagamento: string;
  numero_cupom: number;
  numero_requisicao: number;
  numero_orcamento: number | null;
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
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Funcionario)
    private readonly funcionarioRepository: Repository<Funcionario>,
    @InjectRepository(VisitacaoMetaRepresentante)
    private readonly metaRepository: Repository<VisitacaoMetaRepresentante>,
    @InjectRepository(VisitacaoComissaoFaixa)
    private readonly faixaRepository: Repository<VisitacaoComissaoFaixa>,
    @InjectRepository(CalendarioUnidade)
    private readonly calendarioRepository: Repository<CalendarioUnidade>,
    @InjectRepository(ProducaoFeriado)
    private readonly feriadoRepository: Repository<ProducaoFeriado>,
    @InjectRepository(CaixaFechamento)
    private readonly caixaFechamentoRepository: Repository<CaixaFechamento>,
  ) {}

  async findAll(
    usuario: Usuario,
    dto: FindVisitacaoAcompanhamentoDto,
  ): Promise<VisitacaoAcompanhamentoListResponseDto> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;
    const periodo = periodoCompetencia(dto.ano, dto.mes);

    const filtroRep = await this.resolverFiltroRepresentante(usuario, dto);
    if (filtroRep === 'VAZIO') {
      return this.respostaVazia(page, limit, periodo);
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
    const caixa = await this.consultarRecebidoCaixa(escopo, periodo);
    totais.valorRecebidoCaixa = caixa.valor;
    totais.quantidadeRecebidoCaixa = caixa.quantidade;

    const exporComissao = getUsuarioPermissoes(usuario).includes(
      Permission.VISITACAO_ACOMPANHAMENTO_COMISSAO,
    );

    await this.anexarDesempenho(
      totaisPorRepresentante,
      totais,
      periodo,
      dto.unidade ?? unidadePainel,
      exporComissao,
    );
    await this.anexarEstatisticasPainel(
      totaisPorRepresentante,
      totais,
      periodo,
      unidadePainel,
    );

    return {
      data: rows.map((row) => this.mapItem(row)),
      meta: new PaginationMetaDto(page, limit, totais.quantidadeMedicos),
      totais,
      totaisPorRepresentante,
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
      const noPainelDaUnidadeDoMovimento = await this.crmExisteNoPainel(
        dto.unidade,
        crm,
        uf,
      );
      if (noPainelDaUnidadeDoMovimento) {
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
        t.valor_pago,
        t.nome_medico
      FROM (
        SELECT DISTINCT ON (i.numero_cupom, i.numero_requisicao)
          i.data_operacao AS data_pagamento,
          i.numero_cupom,
          i.numero_requisicao,
          COALESCE(c.numero_orcamento, o.numero_orcamento) AS numero_orcamento,
          ${this.sqlValorRecebidoPrescritor()} AS valor_pago,
          COALESCE(c.nome_medico, o.nome_medico) AS nome_medico
        FROM caixa_itens_erp i
        ${this.sqlJoinCaixaPago()}
        LEFT JOIN LATERAL (
          SELECT
            BTRIM(o0."crmMedico") AS crm,
            UPPER(BTRIM(o0."ufcrmMedico")) AS uf,
            MAX(o0."nomeMedico") AS nome_medico,
            MAX(o0.nrorc) AS numero_orcamento
          FROM orcamentos o0
          WHERE o0.nrorc = i.numero_requisicao
            AND BTRIM(o0."crmMedico") = $2
            AND UPPER(BTRIM(o0."ufcrmMedico")) = $3
          GROUP BY BTRIM(o0."crmMedico"), UPPER(BTRIM(o0."ufcrmMedico"))
          ORDER BY MAX(CASE WHEN o0.unidade = i.unidade THEN 0 ELSE 1 END)
          LIMIT 1
        ) o ON (
          NULLIF(BTRIM(c.crm_medico), '') IS NULL
          OR NULLIF(UPPER(BTRIM(c.uf_crm_medico)), '') IS NULL
        )
        WHERE i.tipo_item = 'REQUISICAO'
          AND i.numero_requisicao IS NOT NULL
          AND i.unidade = $1
          ${this.sqlFiltroPeriodoRecebido('$4', '$5')}
          ${this.sqlFiltroRecebidoVisitacao()}
          AND (
            (BTRIM(c.crm_medico) = $2 AND UPPER(BTRIM(c.uf_crm_medico)) = $3)
            OR o.crm IS NOT NULL
          )
        ORDER BY i.numero_cupom, i.numero_requisicao, i.id
      ) t
      ORDER BY t.data_pagamento ASC, t.numero_cupom ASC, t.numero_requisicao ASC
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
      )
      SELECT
        COALESCE(
          (
            SELECT jsonb_agg(to_jsonb(t) ORDER BY
              CASE WHEN t.nome_representante = 'Sem representante' THEN 1 ELSE 0 END,
              t.nome_representante ASC)
            FROM (
              SELECT
                COALESCE(NULLIF(BTRIM(filtered.nome_representante), ''), 'Sem representante') AS nome_representante,
                filtered.funcionario_id,
                COALESCE(SUM(filtered.valor_recebido), 0) AS valor_recebido,
                COALESCE(SUM(filtered.qtd_recebido), 0) AS qtd_recebido,
                COALESCE(SUM(filtered.valor_rejeitado), 0) AS valor_rejeitado,
                COALESCE(SUM(filtered.qtd_rejeitado), 0) AS qtd_rejeitado,
                COUNT(*)::int AS qtd_medicos
              FROM filtered
              GROUP BY 1, 2
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

    const joinCaixaPago = this.sqlJoinCaixaPago();
    const lateralOrcamento = `
          LEFT JOIN LATERAL (
            SELECT
              BTRIM(o0."crmMedico") AS crm,
              UPPER(BTRIM(o0."ufcrmMedico")) AS uf,
              MAX(o0."nomeMedico") AS nome_medico
            FROM orcamentos o0
            WHERE o0.nrorc = i.numero_requisicao
              AND o0."crmMedico" IS NOT NULL AND BTRIM(o0."crmMedico") <> ''
              AND o0."ufcrmMedico" IS NOT NULL AND BTRIM(o0."ufcrmMedico") <> ''
            GROUP BY BTRIM(o0."crmMedico"), UPPER(BTRIM(o0."ufcrmMedico"))
            ORDER BY MAX(CASE WHEN o0.unidade = i.unidade THEN 0 ELSE 1 END)
            LIMIT 1
          ) o ON (
            NULLIF(BTRIM(c.crm_medico), '') IS NULL
            OR NULLIF(UPPER(BTRIM(c.uf_crm_medico)), '') IS NULL
          )`;
    const selectRecebido = `
            i.unidade,
            i.numero_cupom,
            i.numero_requisicao,
            COALESCE(
              NULLIF(BTRIM(c.crm_medico), ''),
              NULLIF(BTRIM(o.crm), '')
            ) AS crm,
            COALESCE(
              NULLIF(UPPER(BTRIM(c.uf_crm_medico)), ''),
              o.uf
            ) AS uf,
            COALESCE(NULLIF(BTRIM(c.nome_medico), ''), o.nome_medico) AS nome_medico,
            ${this.sqlValorRecebidoPrescritor()} AS valor_recebido`;
    const whereCaixaPeriodo = `
            i.tipo_item = 'REQUISICAO'
            AND i.numero_requisicao IS NOT NULL
            ${this.sqlFiltroPeriodoRecebido('$1', '$2')}
            ${this.sqlFiltroRecebidoVisitacao()}`;
    const semCrmCaixa = `(
              c.id IS NULL
              OR NULLIF(BTRIM(c.crm_medico), '') IS NULL
              OR NULLIF(UPPER(BTRIM(c.uf_crm_medico)), '') IS NULL
            )`;
    const fallbackOrcamentoCarteira = idxCarteira
      ? `
          SELECT * FROM (
            SELECT DISTINCT ON (i.id)
              i.unidade,
              i.numero_cupom,
              i.numero_requisicao,
              BTRIM(o0."crmMedico") AS crm,
              UPPER(BTRIM(o0."ufcrmMedico")) AS uf,
              o0."nomeMedico" AS nome_medico,
              ${this.sqlValorRecebidoPrescritor()} AS valor_recebido
            FROM caixa_itens_erp i
            ${joinCaixaPago}
            INNER JOIN orcamentos o0
              ON o0.nrorc = i.numero_requisicao
              AND o0."crmMedico" IS NOT NULL AND BTRIM(o0."crmMedico") <> ''
              AND o0."ufcrmMedico" IS NOT NULL AND BTRIM(o0."ufcrmMedico") <> ''
            INNER JOIN crms_carteira cc
              ON cc.crm = BTRIM(o0."crmMedico")
              AND cc.uf = UPPER(BTRIM(o0."ufcrmMedico"))
            WHERE ${whereCaixaPeriodo}
              AND ${semCrmCaixa}
              ${modoPainel === 'todos' ? `AND i.unidade IS DISTINCT FROM $${idxCarteira}` : ''}
              AND ${this.sqlIndicacaoSemPainelLocal(
                idxCarteira,
                'i.unidade',
                'BTRIM(o0."crmMedico")',
                'UPPER(BTRIM(o0."ufcrmMedico"))',
              )}
            ORDER BY i.id, CASE WHEN o0.unidade = i.unidade THEN 0 ELSE 1 END
          ) fallback_orc`
      : '';
    const recebidosCaixaCarteira = idxCarteira
      ? `
          SELECT
            i.unidade,
            i.numero_cupom,
            i.numero_requisicao,
            BTRIM(c.crm_medico) AS crm,
            UPPER(BTRIM(c.uf_crm_medico)) AS uf,
            NULLIF(BTRIM(c.nome_medico), '') AS nome_medico,
            ${this.sqlValorRecebidoPrescritor()} AS valor_recebido
          FROM caixa_itens_erp i
          ${joinCaixaPago}
          INNER JOIN crms_carteira cc
            ON cc.crm = BTRIM(c.crm_medico)
            AND cc.uf = UPPER(BTRIM(c.uf_crm_medico))
          WHERE ${whereCaixaPeriodo}
            AND c.id IS NOT NULL
            AND NULLIF(BTRIM(c.crm_medico), '') IS NOT NULL
            AND NULLIF(UPPER(BTRIM(c.uf_crm_medico)), '') IS NOT NULL
            ${modoPainel === 'todos' ? `AND i.unidade IS DISTINCT FROM $${idxCarteira}` : ''}
            AND ${this.sqlIndicacaoSemPainelLocal(
              idxCarteira,
              'i.unidade',
              'BTRIM(c.crm_medico)',
              'UPPER(BTRIM(c.uf_crm_medico))',
            )}`
      : '';

    const wrapRecebidoUnico = (innerSql: string): string => `
        FROM (
          SELECT DISTINCT ON (g.unidade, g.numero_cupom, g.numero_requisicao)
            g.unidade,
            g.crm,
            g.uf,
            g.nome_medico,
            g.valor_recebido
          FROM (
            ${innerSql}
          ) g
          ORDER BY g.unidade, g.numero_cupom, g.numero_requisicao
        ) src`;

    let recebidosFrom: string;
    let rejeitadosExtra = '';
    if (idxCarteira && modoPainel === 'sim') {
      recebidosFrom = wrapRecebidoUnico(`
          ${recebidosCaixaCarteira}
          UNION ALL
          ${fallbackOrcamentoCarteira}
      `);
      rejeitadosExtra = `
          AND EXISTS (
            SELECT 1 FROM crms_carteira cc
            WHERE cc.crm = BTRIM(o."crmMedico")
              AND cc.uf = UPPER(BTRIM(o."ufcrmMedico"))
          )
          AND ${this.sqlIndicacaoSemPainelLocal(
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
          ${lateralOrcamento}
          WHERE ${whereCaixaPeriodo}
            AND i.unidade = $${idxCarteira}
      `);
      rejeitadosExtra = ` AND o.unidade = $${idxCarteira}`;
    } else if (idxCarteira && modoPainel === 'todos') {
      recebidosFrom = wrapRecebidoUnico(`
          SELECT ${selectRecebido}
          FROM caixa_itens_erp i
          ${joinCaixaPago}
          ${lateralOrcamento}
          WHERE ${whereCaixaPeriodo}
            AND i.unidade = $${idxCarteira}
          UNION ALL
          ${recebidosCaixaCarteira}
          UNION ALL
          ${fallbackOrcamentoCarteira}
      `);
      rejeitadosExtra = `
          AND (
            o.unidade = $${idxCarteira}
            OR (
              EXISTS (
                SELECT 1 FROM crms_carteira cc
                WHERE cc.crm = BTRIM(o."crmMedico")
                  AND cc.uf = UPPER(BTRIM(o."ufcrmMedico"))
              )
              AND ${this.sqlMedicoSemPainelNaUnidade(
                'o.unidade',
                'BTRIM(o."crmMedico")',
                'UPPER(BTRIM(o."ufcrmMedico"))',
              )}
            )
          )`;
    } else {
      recebidosFrom = wrapRecebidoUnico(`
          SELECT ${selectRecebido}
          FROM caixa_itens_erp i
          ${joinCaixaPago}
          ${lateralOrcamento}
          WHERE ${whereCaixaPeriodo}
      `);
    }

    const crmsCte = idxCarteira
      ? `crms_carteira AS MATERIALIZED (
        SELECT DISTINCT
          BTRIM(p."crmMedico") AS crm,
          UPPER(BTRIM(p."ufCrmMedico")) AS uf
        FROM painel_medicos_representantes p
        WHERE p.unidade = $${idxCarteira}
          AND NULLIF(BTRIM(p."crmMedico"), '') IS NOT NULL
          AND NULLIF(BTRIM(p."ufCrmMedico"), '') IS NOT NULL
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
        ` AND ${this.sqlIndicacaoSemPainelLocal(
          idxCarteira,
          'b.unidade',
          'b.crm',
          'b.uf',
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
   * Indicação interunidade só entra se o médico não estiver no painel
   * da unidade do recebimento/rejeição.
   */
  private sqlIndicacaoSemPainelLocal(
    idxCarteira: number,
    unidadeExpr: string,
    crmExpr: string,
    ufExpr: string,
  ): string {
    return `(
      ${unidadeExpr} = $${idxCarteira}
      OR ${this.sqlMedicoSemPainelNaUnidade(unidadeExpr, crmExpr, ufExpr)}
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
    };
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
            AND i.unidade = $3
          UNION ALL
          SELECT
            i.unidade,
            i.numero_cupom,
            i.numero_requisicao,
            ${valor} AS valor_recebido
          FROM caixa_itens_erp i
          ${join}
          INNER JOIN painel_medicos_representantes p
            ON p.unidade = $3
            AND BTRIM(p."crmMedico") = BTRIM(c.crm_medico)
            AND UPPER(BTRIM(p."ufCrmMedico")) = UPPER(BTRIM(c.uf_crm_medico))
            AND NULLIF(BTRIM(p."crmMedico"), '') IS NOT NULL
            AND NULLIF(BTRIM(p."ufCrmMedico"), '') IS NOT NULL
          WHERE ${where}
            AND i.unidade IS DISTINCT FROM $3
            AND c.id IS NOT NULL
            AND NULLIF(BTRIM(c.crm_medico), '') IS NOT NULL
            AND NULLIF(UPPER(BTRIM(c.uf_crm_medico)), '') IS NOT NULL
            AND ${this.sqlMedicoSemPainelNaUnidade(
              'i.unidade',
              'BTRIM(c.crm_medico)',
              'UPPER(BTRIM(c.uf_crm_medico))',
            )}
          UNION ALL
          SELECT i.unidade, i.numero_cupom, i.numero_requisicao, i.valor_recebido
          FROM (
            SELECT DISTINCT ON (i.id)
              i.unidade,
              i.numero_cupom,
              i.numero_requisicao,
              ${valor} AS valor_recebido
            FROM caixa_itens_erp i
            ${join}
            INNER JOIN orcamentos o0
              ON o0.nrorc = i.numero_requisicao
              AND o0."crmMedico" IS NOT NULL AND BTRIM(o0."crmMedico") <> ''
              AND o0."ufcrmMedico" IS NOT NULL AND BTRIM(o0."ufcrmMedico") <> ''
            INNER JOIN painel_medicos_representantes p
              ON p.unidade = $3
              AND BTRIM(p."crmMedico") = BTRIM(o0."crmMedico")
              AND UPPER(BTRIM(p."ufCrmMedico")) = UPPER(BTRIM(o0."ufcrmMedico"))
            WHERE ${where}
              AND i.unidade IS DISTINCT FROM $3
              AND (
                c.id IS NULL
                OR NULLIF(BTRIM(c.crm_medico), '') IS NULL
                OR NULLIF(UPPER(BTRIM(c.uf_crm_medico)), '') IS NULL
              )
              AND ${this.sqlMedicoSemPainelNaUnidade(
                'i.unidade',
                'BTRIM(o0."crmMedico")',
                'UPPER(BTRIM(o0."ufcrmMedico"))',
              )}
            ORDER BY i.id, CASE WHEN o0.unidade = i.unidade THEN 0 ELSE 1 END
          ) i`;
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

  private async anexarEstatisticasPainel(
    grupos: VisitacaoAcompanhamentoTotaisRepresentanteDto[],
    totais: VisitacaoAcompanhamentoTotaisDto,
    periodo: PeriodoCompetencia,
    unidadePainel: Unidade | null,
  ): Promise<void> {
    const params: unknown[] = [periodo.dataInicial, periodo.dataFinal];
    const filtroUnidade = unidadePainel
      ? `AND p.unidade = $3`
      : '';
    if (unidadePainel) {
      params.push(unidadePainel);
    }

    const sql = `
      WITH mov AS (
        SELECT DISTINCT crm, uf FROM (
          SELECT
            BTRIM(c.crm_medico) AS crm,
            UPPER(BTRIM(c.uf_crm_medico)) AS uf
          FROM caixa_itens_erp i
          ${this.sqlJoinCaixaPago()}
          WHERE i.tipo_item = 'REQUISICAO'
            AND i.numero_requisicao IS NOT NULL
            ${this.sqlFiltroPeriodoRecebido('$1', '$2')}
            ${this.sqlFiltroRecebidoVisitacao()}
            AND NULLIF(BTRIM(c.crm_medico), '') IS NOT NULL
            AND NULLIF(UPPER(BTRIM(c.uf_crm_medico)), '') IS NOT NULL
          UNION
          SELECT
            BTRIM(o0."crmMedico") AS crm,
            UPPER(BTRIM(o0."ufcrmMedico")) AS uf
          FROM caixa_itens_erp i
          ${this.sqlJoinCaixaPago()}
          INNER JOIN orcamentos o0
            ON o0.nrorc = i.numero_requisicao
            AND o0."crmMedico" IS NOT NULL AND BTRIM(o0."crmMedico") <> ''
            AND o0."ufcrmMedico" IS NOT NULL AND BTRIM(o0."ufcrmMedico") <> ''
          WHERE i.tipo_item = 'REQUISICAO'
            AND i.numero_requisicao IS NOT NULL
            ${this.sqlFiltroPeriodoRecebido('$1', '$2')}
            ${this.sqlFiltroRecebidoVisitacao()}
            AND (
              c.id IS NULL
              OR NULLIF(BTRIM(c.crm_medico), '') IS NULL
              OR NULLIF(UPPER(BTRIM(c.uf_crm_medico)), '') IS NULL
            )
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
  ): VisitacaoAcompanhamentoListResponseDto {
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
        quantidadeMedicosPainel: 0,
        quantidadeMedicosForaAtendimento: 0,
        ...this.desempenhoBase(periodo),
      },
      totaisPorRepresentante: [],
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

