import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import { resolverEscopoListaFechamentoPorUsuario } from '../folha/utils/folha-unidade-scope.util';
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
  ) {}

  async findAll(
    usuario: Usuario,
    dto: FindVisitacaoAcompanhamentoDto,
  ): Promise<VisitacaoAcompanhamentoListResponseDto> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;
    this.assertPeriodo(dto.dataInicial, dto.dataFinal);

    const filtroRep = await this.resolverFiltroRepresentante(usuario, dto);
    if (filtroRep === 'VAZIO') {
      return this.respostaVazia(page, limit);
    }

    const { sql: baseSql, params } = this.montarSqlFiltrado(
      usuario,
      dto,
      filtroRep === 'NENHUM' ? null : filtroRep,
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
    const totaisPorRepresentante = this.asJsonArray<TotaisRepresentanteRow>(
      combined?.totais_por_representante,
    ).map((row) => this.mapTotaisRepresentante(row));
    const totais = this.somarTotais(totaisPorRepresentante);
    const rows = this.asJsonArray<RowAgregado>(combined?.data);

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
    this.assertPeriodo(dto.dataInicial, dto.dataFinal);
    const dtoOpcoes = { ...dto, nomesMedico: undefined };
    const filtroRep = await this.resolverFiltroRepresentante(usuario, dtoOpcoes);
    if (filtroRep === 'VAZIO') {
      return { medicos: [] };
    }

    const { sql: baseSql, params } = this.montarSqlFiltrado(
      usuario,
      dtoOpcoes,
      filtroRep === 'NENHUM' ? null : filtroRep,
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
        i.data_operacao AS data_pagamento,
        i.numero_cupom,
        i.numero_requisicao,
        COALESCE(c.numero_orcamento, o.numero_orcamento) AS numero_orcamento,
        i.valor_liquido_linha AS valor_pago,
        COALESCE(c.nome_medico, o.nome_medico) AS nome_medico
      FROM caixa_itens_erp i
      LEFT JOIN caixa_requisicoes_pagas c
        ON c.unidade = i.unidade
        AND c.numero_requisicao = i.numero_requisicao
        AND c.numero_cupom = i.numero_cupom
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
        AND i.data_operacao >= $4
        AND i.data_operacao <= $5
        AND (
          (BTRIM(c.crm_medico) = $2 AND UPPER(BTRIM(c.uf_crm_medico)) = $3)
          OR o.crm IS NOT NULL
        )
      ORDER BY i.data_operacao ASC, i.numero_cupom ASC, i.numero_requisicao ASC
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
                COALESCE(SUM(filtered.valor_recebido), 0) AS valor_recebido,
                COALESCE(SUM(filtered.qtd_recebido), 0) AS qtd_recebido,
                COALESCE(SUM(filtered.valor_rejeitado), 0) AS valor_rejeitado,
                COALESCE(SUM(filtered.qtd_rejeitado), 0) AS qtd_rejeitado,
                COUNT(*)::int AS qtd_medicos
              FROM filtered
              GROUP BY 1
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
  ): SqlBuild {
    const params: unknown[] = [dto.dataInicial, dto.dataFinal];
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

    const joinCaixaPago = `
          LEFT JOIN caixa_requisicoes_pagas c
            ON c.unidade = i.unidade
            AND c.numero_requisicao = i.numero_requisicao
            AND c.numero_cupom = i.numero_cupom`;
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
            COALESCE(
              NULLIF(BTRIM(c.crm_medico), ''),
              NULLIF(BTRIM(o.crm), '')
            ) AS crm,
            COALESCE(
              NULLIF(UPPER(BTRIM(c.uf_crm_medico)), ''),
              o.uf
            ) AS uf,
            COALESCE(NULLIF(BTRIM(c.nome_medico), ''), o.nome_medico) AS nome_medico,
            i.valor_liquido_linha AS valor_recebido`;
    const whereCaixaPeriodo = `
            i.tipo_item = 'REQUISICAO'
            AND i.numero_requisicao IS NOT NULL
            AND i.data_operacao >= $1
            AND i.data_operacao <= $2`;
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
              BTRIM(o0."crmMedico") AS crm,
              UPPER(BTRIM(o0."ufcrmMedico")) AS uf,
              o0."nomeMedico" AS nome_medico,
              i.valor_liquido_linha AS valor_recebido
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
            BTRIM(c.crm_medico) AS crm,
            UPPER(BTRIM(c.uf_crm_medico)) AS uf,
            NULLIF(BTRIM(c.nome_medico), '') AS nome_medico,
            i.valor_liquido_linha AS valor_recebido
          FROM caixa_itens_erp i
          INNER JOIN caixa_requisicoes_pagas c
            ON c.unidade = i.unidade
            AND c.numero_requisicao = i.numero_requisicao
            AND c.numero_cupom = i.numero_cupom
          INNER JOIN crms_carteira cc
            ON cc.crm = BTRIM(c.crm_medico)
            AND cc.uf = UPPER(BTRIM(c.uf_crm_medico))
          WHERE ${whereCaixaPeriodo}
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

    let recebidosFrom: string;
    let rejeitadosExtra = '';
    if (idxCarteira && modoPainel === 'sim') {
      recebidosFrom = `
        FROM (
          ${recebidosCaixaCarteira}
          UNION ALL
          ${fallbackOrcamentoCarteira}
        ) src`;
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
      recebidosFrom = `
        FROM (
          SELECT ${selectRecebido}
          FROM caixa_itens_erp i
          ${joinCaixaPago}
          ${lateralOrcamento}
          WHERE ${whereCaixaPeriodo}
            AND i.unidade = $${idxCarteira}
        ) src`;
      rejeitadosExtra = ` AND o.unidade = $${idxCarteira}`;
    } else if (idxCarteira && modoPainel === 'todos') {
      recebidosFrom = `
        FROM (
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
        ) src`;
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
      recebidosFrom = `
        FROM (
          SELECT ${selectRecebido}
          FROM caixa_itens_erp i
          ${joinCaixaPago}
          ${lateralOrcamento}
          WHERE ${whereCaixaPeriodo}
        ) src`;
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

  private mapTotais(row?: TotaisRow): VisitacaoAcompanhamentoTotaisDto {
    return {
      valorRecebido: this.toNumber(row?.valor_recebido),
      quantidadeRecebido: this.toInt(row?.qtd_recebido),
      valorRejeitado: this.toNumber(row?.valor_rejeitado),
      quantidadeRejeitado: this.toInt(row?.qtd_rejeitado),
      quantidadeMedicos: this.toInt(row?.qtd_medicos),
    };
  }

  private mapTotaisRepresentante(
    row: TotaisRepresentanteRow,
  ): VisitacaoAcompanhamentoTotaisRepresentanteDto {
    return {
      nomeRepresentante: row.nome_representante?.trim() || 'Sem representante',
      ...this.mapTotais(row),
    };
  }

  private somarTotais(
    grupos: VisitacaoAcompanhamentoTotaisRepresentanteDto[],
  ): VisitacaoAcompanhamentoTotaisDto {
    return grupos.reduce(
      (acc, grupo) => ({
        valorRecebido: acc.valorRecebido + grupo.valorRecebido,
        quantidadeRecebido: acc.quantidadeRecebido + grupo.quantidadeRecebido,
        valorRejeitado: acc.valorRejeitado + grupo.valorRejeitado,
        quantidadeRejeitado: acc.quantidadeRejeitado + grupo.quantidadeRejeitado,
        quantidadeMedicos: acc.quantidadeMedicos + grupo.quantidadeMedicos,
      }),
      {
        valorRecebido: 0,
        quantidadeRecebido: 0,
        valorRejeitado: 0,
        quantidadeRejeitado: 0,
        quantidadeMedicos: 0,
      },
    );
  }

  private respostaVazia(
    page: number,
    limit: number,
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

  private toNumber(value: string | number | null | undefined): number {
    if (value == null || value === '') return 0;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private toInt(value: string | number | null | undefined): number {
    return Math.trunc(this.toNumber(value));
  }
}
