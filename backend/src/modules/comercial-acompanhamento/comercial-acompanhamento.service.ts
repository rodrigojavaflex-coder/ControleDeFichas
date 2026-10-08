import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Funcionario } from '../folha/entities/funcionario.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import { ComercialTipoBase } from '../../common/enums/comercial-tipo-base.enum';
import { ComercialIncidenciaComissao } from '../../common/enums/comercial-incidencia-comissao.enum';
import { assertUnidadeFolha } from '../folha/utils/folha-unidade-scope.util';
import { ComercialMetaVendedor } from '../comercial-meta/entities/comercial-meta-vendedor.entity';
import { ComercialMetaUnidade } from '../comercial-meta/entities/comercial-meta-unidade.entity';
import { ComercialComissaoFaixa } from '../comercial-meta/entities/comercial-comissao-faixa.entity';
import { ComercialComissaoPolitica } from '../comercial-meta/entities/comercial-comissao-politica.entity';
import { ComercialComissaoPoliticaUnidade } from '../comercial-meta/entities/comercial-comissao-politica-unidade.entity';
import { CalendarioUnidade } from '../producao-config/entities/calendario-unidade.entity';
import { ProducaoFeriado } from '../producao-config/entities/producao-feriado.entity';
import { CaixaFechamento } from '../fechamento-caixa/entities/caixa-fechamento.entity';
import { CaixaFechamentoStatus } from '../fechamento-caixa/enums/caixa-fechamento-status.enum';
import { Permission } from '../../common/enums/permission.enum';
import { getUsuarioPermissoes } from '../../common/utils/usuario-permissoes.util';
import {
  competenciaAberta,
  periodoCompetencia,
  somarDiasUteisVisitacao,
  somarDiasRealizadosVisitacao,
  ymdHojeSp,
} from '../visitacao-acompanhamento/utils/visitacao-dias-uteis.util';
import {
  ComercialAcompanhamentoDetalheDto,
  ComercialAcompanhamentoItemDto,
  ComercialAcompanhamentoListResponseDto,
  ComercialAcompanhamentoTotaisDto,
  ComercialAcompanhamentoVendedorOpcaoDto,
  FindComercialAcompanhamentoDetalheDto,
  FindComercialAcompanhamentoDto,
} from './dto/comercial-acompanhamento.dto';

const NOME_SEM_VINCULO = 'Sem vínculo';
/** Agrupa movimento sem `codigo_vendedor` na paga; não gera card (RN-COM-004). */
const CODIGO_SEM_VINCULO = -1;

type MovimentoRow = {
  codigo_vendedor: number | null;
  nome_vendedor: string | null;
  valor: string | number;
  qtd: string | number;
  qtd_formulas?: string | number | null;
};

type MapaMovimento = Map<
  number,
  { nome: string; valor: number; qtd: number; qtdFormulas: number }
>;

@Injectable()
export class ComercialAcompanhamentoService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Funcionario)
    private readonly funcionarioRepo: Repository<Funcionario>,
    @InjectRepository(ComercialMetaVendedor)
    private readonly metaRepo: Repository<ComercialMetaVendedor>,
    @InjectRepository(ComercialMetaUnidade)
    private readonly metaUnidadeRepo: Repository<ComercialMetaUnidade>,
    @InjectRepository(ComercialComissaoFaixa)
    private readonly faixaRepo: Repository<ComercialComissaoFaixa>,
    @InjectRepository(ComercialComissaoPolitica)
    private readonly politicaRepo: Repository<ComercialComissaoPolitica>,
    @InjectRepository(ComercialComissaoPoliticaUnidade)
    private readonly politicaUnidadeRepo: Repository<ComercialComissaoPoliticaUnidade>,
    @InjectRepository(CalendarioUnidade)
    private readonly calendarioRepo: Repository<CalendarioUnidade>,
    @InjectRepository(ProducaoFeriado)
    private readonly feriadoRepo: Repository<ProducaoFeriado>,
    @InjectRepository(CaixaFechamento)
    private readonly caixaFechamentoRepo: Repository<CaixaFechamento>,
  ) {}

  async listarVendedoresOpcoes(
    usuario: Usuario,
    unidade: Unidade,
  ): Promise<ComercialAcompanhamentoVendedorOpcaoDto[]> {
    assertUnidadeFolha(usuario, unidade);
    const rows = await this.funcionarioRepo
      .createQueryBuilder('f')
      .where('f.unidade = :unidade', { unidade })
      .andWhere('f.codigoVendedorErp IS NOT NULL')
      .andWhere('f.codigoVendedorErp > 0')
      .orderBy('f.nome', 'ASC')
      .getMany();
    return rows.map((f) => ({
      funcionarioId: f.id,
      nome: f.nome,
      codigoVendedorErp: f.codigoVendedorErp!,
    }));
  }

  async findAll(
    usuario: Usuario,
    dto: FindComercialAcompanhamentoDto,
  ): Promise<ComercialAcompanhamentoListResponseDto> {
    assertUnidadeFolha(usuario, dto.unidade);
    const periodo = periodoCompetencia(dto.ano, dto.mes);
    const exporComissao = getUsuarioPermissoes(usuario).includes(
      Permission.COMERCIAL_ACOMPANHAMENTO_COMISSAO,
    );

    const ultimaConfirmada = await this.buscarUltimaDataCaixaConfirmada(
      dto.unidade,
    );
    const tetoLoja = this.dataTetoCaixaConfirmado(
      periodo.dataInicial,
      periodo.dataFinal,
      ultimaConfirmada,
    );

    const politicaUnidade = await this.politicaUnidadeRepo.findOne({
      where: { unidade: dto.unidade },
    });
    const setoresUnidade = this.normalizarCodigosSetor(
      politicaUnidade?.codigosSetor,
    );
    const setoresUnidadeRevenda = this.normalizarCodigosSetor(
      politicaUnidade?.codigosSetorRevendaManipulados,
    );

    const [
      reqMap,
      mpMap,
      rejMap,
      vinculados,
      volumeLoja,
      revendaMap,
      politicasReq,
      terceirosLoja,
      terceirosPorCodigo,
    ] =
      await Promise.all([
        tetoLoja
          ? this.buscarRecebidoRequisicao(
              dto.unidade,
              periodo.dataInicial,
              tetoLoja,
            )
          : Promise.resolve(new Map() as MapaMovimento),
        this.buscarRecebidoMarcaPropria(
          dto.unidade,
          periodo.dataInicial,
          periodo.dataFinal,
        ),
        this.buscarRejeitado(dto.unidade, periodo.dataInicial, periodo.dataFinal),
        this.funcionarioRepo
          .createQueryBuilder('f')
          .where('f.unidade = :unidade', { unidade: dto.unidade })
          .andWhere('f.codigoVendedorErp IS NOT NULL')
          .andWhere('f.codigoVendedorErp > 0')
          .orderBy('f.nome', 'ASC')
          .getMany(),
        tetoLoja
          ? this.buscarVolumeLoja(
              dto.unidade,
              periodo.dataInicial,
              tetoLoja,
              setoresUnidade,
              setoresUnidadeRevenda,
            )
          : Promise.resolve({
              marcaPropria: {
                valor: 0,
                qtd: 0,
                valorSetores: 0,
                qtdSetores: 0,
              },
              revendaManipulados: { valor: 0, qtd: 0 },
            }),
        tetoLoja
          ? this.buscarRecebidoRevendaManipulados(
              dto.unidade,
              periodo.dataInicial,
              tetoLoja,
            )
          : Promise.resolve(new Map() as MapaMovimento),
        this.politicaRepo
          .createQueryBuilder('p')
          .innerJoinAndSelect('p.funcionario', 'f')
          .where('f.unidade = :unidade', { unidade: dto.unidade })
          .andWhere('p.tipoBase = :tipo', {
            tipo: ComercialTipoBase.REQUISICAO,
          })
          .getMany(),
        tetoLoja
          ? this.buscarRecebidoTerceiros(
              dto.unidade,
              periodo.dataInicial,
              tetoLoja,
            )
          : Promise.resolve({ valor: 0, qtd: 0 }),
        tetoLoja
          ? this.buscarRecebidoTerceirosPorVendedor(
              dto.unidade,
              periodo.dataInicial,
              tetoLoja,
            )
          : Promise.resolve(new Map() as Map<number, { valor: number; qtd: number }>),
      ]);

    const setoresRevendaPorCodigo = new Map<number, number[]>();
    for (const p of politicasReq) {
      const codigo = p.funcionario?.codigoVendedorErp;
      if (codigo == null || codigo <= 0) continue;
      setoresRevendaPorCodigo.set(
        codigo,
        this.normalizarCodigosSetor(p.codigosSetorRevendaManipulados),
      );
    }

    const todosItens: ComercialAcompanhamentoItemDto[] = vinculados
      .map((f) =>
        this.montarItem(
          f.id,
          f.nome,
          f.codigoVendedorErp!,
          reqMap,
          mpMap,
          rejMap,
          revendaMap,
          setoresRevendaPorCodigo.get(f.codigoVendedorErp!) ?? [],
          terceirosPorCodigo,
        ),
      )
      .sort(
        (a, b) =>
          b.valorRecebidoRequisicao +
          b.valorRecebidoMarcaPropria -
          (a.valorRecebidoRequisicao + a.valorRecebidoMarcaPropria),
      );

    const totais = this.somarTotais(todosItens);
    const lojaRecebidoMp = volumeLoja.marcaPropria;
    const lojaRejeitado = this.somarMapa(rejMap);
    const usaSetores = setoresUnidade.length > 0;
    const lojaMpMeta = usaSetores
      ? lojaRecebidoMp.valorSetores
      : lojaRecebidoMp.valor;
    const lojaMpQtd = usaSetores
      ? lojaRecebidoMp.qtdSetores
      : lojaRecebidoMp.qtd;
    const puraLoja = this.round2(totais.valorRequisicaoPura);
    const extraLoja = volumeLoja.revendaManipulados;
    const terceirosValor = this.round2(terceirosLoja.valor);
    const lojaComissaoReq = this.round2(puraLoja + extraLoja.valor);
    totais.valorRequisicaoPura = puraLoja;
    totais.valorRevendaManipulados = extraLoja.valor;
    totais.quantidadeRevendaManipulados = extraLoja.qtd;
    totais.codigosSetorRevendaManipulados = setoresUnidadeRevenda;
    totais.valorTerceirosManipulados = terceirosValor;
    totais.quantidadeTerceirosManipulados = terceirosLoja.qtd;
    totais.valorComissaoBaseRequisicao = lojaComissaoReq;
    totais.valorRecebidoRequisicao = this.round2(lojaComissaoReq + terceirosValor);
    totais.valorRecebidoMarcaPropria = lojaMpMeta;
    totais.quantidadeRecebidoMarcaPropria = lojaMpQtd;
    totais.codigosSetorMarcaPropria = setoresUnidade;
    totais.valorRecebidoMarcaPropriaSetores = lojaRecebidoMp.valorSetores;
    totais.quantidadeRecebidoMarcaPropriaSetores = lojaRecebidoMp.qtdSetores;
    totais.valorRejeitado = lojaRejeitado.valor;
    totais.quantidadeRejeitado = lojaRejeitado.qtd;

    await this.anexarDesempenho(
      todosItens,
      totais,
      periodo,
      dto.unidade,
      exporComissao,
      totais.valorRecebidoRequisicao,
      lojaComissaoReq,
      lojaMpMeta,
      ultimaConfirmada,
    );

    const itens = dto.funcionarioId
      ? todosItens.filter((i) => i.funcionarioId === dto.funcionarioId)
      : todosItens;

    return {
      itens,
      totais,
      anoMes: periodo.anoMes,
      dataInicial: periodo.dataInicial,
      dataFinal: periodo.dataFinal,
    };
  }

  async detalhe(
    usuario: Usuario,
    dto: FindComercialAcompanhamentoDetalheDto,
  ): Promise<ComercialAcompanhamentoDetalheDto> {
    assertUnidadeFolha(usuario, dto.unidade);
    if (!dto.funcionarioId) {
      return this.detalheUnidade(dto);
    }
    const funcionario = await this.funcionarioRepo.findOne({
      where: { id: dto.funcionarioId, unidade: dto.unidade },
    });
    if (
      !funcionario ||
      funcionario.codigoVendedorErp == null ||
      funcionario.codigoVendedorErp <= 0
    ) {
      throw new NotFoundException('Vendedor não encontrado na unidade.');
    }

    const periodo = periodoCompetencia(dto.ano, dto.mes);
    const codigo = funcionario.codigoVendedorErp;
    const ultimaConfirmada = await this.buscarUltimaDataCaixaConfirmada(
      dto.unidade,
    );
    const tetoManip = this.dataTetoCaixaConfirmado(
      periodo.dataInicial,
      periodo.dataFinal,
      ultimaConfirmada,
    );
    const paramsMpRej = [
      dto.unidade,
      periodo.dataInicial,
      periodo.dataFinal,
      codigo,
    ];
    const [politicaMp, politicaReq] = await Promise.all([
      this.politicaRepo.findOne({
        where: {
          funcionario: { id: funcionario.id },
          tipoBase: ComercialTipoBase.MARCA_PROPRIA,
        },
      }),
      this.politicaRepo.findOne({
        where: {
          funcionario: { id: funcionario.id },
          tipoBase: ComercialTipoBase.REQUISICAO,
        },
      }),
    ]);
    const setoresMp = (politicaMp?.codigosSetor ?? [])
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n > 0);
    const setoresRevenda = (politicaReq?.codigosSetorRevendaManipulados ?? [])
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n > 0);
    const filtroSetorSql =
      setoresMp.length > 0 ? ' AND i.codigo_setor = ANY($5::int[])' : '';
    const paramsMp = setoresMp.length > 0 ? [...paramsMpRej, setoresMp] : paramsMpRej;

    const [reqRows, mpRows, rejRows, tercRows, setorRows] = await Promise.all([
      tetoManip
        ? (this.dataSource.query(
            `
          SELECT
            t.data,
            t.numero_cupom,
            t.numero_requisicao,
            t.valor
          FROM (
            SELECT
              MIN(i.data_operacao) AS data,
              i.numero_cupom,
              i.numero_requisicao,
              GREATEST(
                0,
                LEAST(
                  SUM(i.valor_liquido_item - COALESCE(i.valor_taxa, 0)),
                  MAX(
                    COALESCE(
                      c.valor_pago_requisicao - COALESCE(c.valor_taxa, 0),
                      i.valor_liquido_item - COALESCE(i.valor_taxa, 0)
                    )
                  )
                )
              ) AS valor
            FROM caixa_itens_erp i
            INNER JOIN caixa_pagamentos_erp p ON p.id = i.pagamento_id
            ${this.sqlJoinCaixaPago()}
            WHERE i.tipo_item = 'REQUISICAO'
              AND i.unidade = $1
              AND i.numero_requisicao IS NOT NULL
              AND i.data_operacao >= $2
              AND i.data_operacao <= $3
              AND COALESCE(c.tipo_requisicao, '') <> 'C'
              AND c.codigo_vendedor = $4
            GROUP BY i.numero_cupom, i.numero_requisicao
            UNION ALL
            SELECT
              c.data_pagamento AS data,
              c.numero_cupom,
              c.numero_requisicao,
              GREATEST(
                0,
                COALESCE(c.valor_pago_requisicao, 0) - COALESCE(c.valor_taxa, 0)
              ) AS valor
            FROM caixa_requisicoes_pagas c
            WHERE c.unidade = $1
              AND c.data_pagamento >= $2
              AND c.data_pagamento <= $3
              AND COALESCE(c.tipo_requisicao, '') <> 'C'
              AND c.codigo_vendedor = $4
              AND ${this.sqlPagaSemItemComPagamento('c')}
          ) t
          ORDER BY t.data ASC, t.numero_cupom ASC, t.numero_requisicao ASC
        `,
            [dto.unidade, periodo.dataInicial, tetoManip, codigo],
          ) as Promise<
            Array<{
              data: string | Date;
              numero_cupom: string | number;
              numero_requisicao: string | number;
              valor: string | number;
            }>
          >)
        : Promise.resolve([]),
      this.dataSource.query(
        `
          SELECT
            i.data_operacao AS data,
            i.numero_cupom,
            i.descricao_item,
            i.quantidade,
            GREATEST(
              0,
              i.valor_liquido_item - COALESCE(i.valor_desconto_varejo, 0)
            ) AS valor
          FROM caixa_itens_erp i
          INNER JOIN caixa_pagamentos_erp p ON p.id = i.pagamento_id
          WHERE i.tipo_item = 'PRODUTO'
            AND i.unidade = $1
            AND i.data_operacao >= $2
            AND i.data_operacao <= $3
            AND p.codigo_operador_caixa = $4
            ${filtroSetorSql}
          ORDER BY i.data_operacao ASC, i.numero_cupom ASC, i.sequencia_item ASC
        `,
        paramsMp,
      ) as Promise<
        Array<{
          data: string | Date;
          numero_cupom: string | number;
          descricao_item: string | null;
          quantidade: string | number;
          valor: string | number;
        }>
      >,
      this.dataSource.query(
        `
          SELECT
            o."dataOrcamento" AS data_orcamento,
            o."nrOrcamento" AS nr_orcamento,
            o."nomeCliente" AS nome_cliente,
            o."precoVenda" AS preco_venda,
            m.descricao AS motivo_rejeicao
          FROM orcamentos o
          LEFT JOIN orcamento_motivo_rejeicao m ON m.id = o."motivoRejeicaoId"
          WHERE o.unidade = $1
            AND o.status = 'REJEITADO'
            AND o."dataOrcamento" >= $2
            AND o."dataOrcamento" <= $3
            AND o."codigoVendedor" = $4
          ORDER BY o."dataOrcamento" ASC, o."nrOrcamento" ASC
        `,
        paramsMpRej,
      ) as Promise<
        Array<{
          data_orcamento: string | Date;
          nr_orcamento: string;
          nome_cliente: string | null;
          preco_venda: string | number;
          motivo_rejeicao: string | null;
        }>
      >,
      tetoManip
        ? (this.dataSource.query(
            `
          SELECT
            b."dataBaixa" AS data_baixa,
            v.protocolo,
            v."dataVenda" AS data_venda,
            c.nome AS nome_cliente,
            CAST(b."valorBaixa" AS NUMERIC) AS valor
          FROM baixas b
          INNER JOIN vendas v ON v.id = b.idvenda
          INNER JOIN vendedores ven ON ven.id = v."vendedorId"
          INNER JOIN funcionarios f
            ON f."codigoVendedorErp" = ven."cdVendedor"
           AND f.unidade = v.unidade::text
          LEFT JOIN clientes c ON c.id = v."clienteId"
          WHERE v.unidade = $1
            AND b."dataBaixa" >= $2
            AND b."dataBaixa" <= $3
            AND f."codigoVendedorErp" = $4
            AND f."codigoVendedorErp" IS NOT NULL
            AND f."codigoVendedorErp" > 0
          ORDER BY b."dataBaixa" ASC, v.protocolo ASC
        `,
            [dto.unidade, periodo.dataInicial, tetoManip, codigo],
          ) as Promise<
            Array<{
              data_baixa: string | Date;
              protocolo: string;
              data_venda: string | Date | null;
              nome_cliente: string | null;
              valor: string | number;
            }>
          >)
        : Promise.resolve([]),
      tetoManip && setoresRevenda.length
        ? (this.dataSource.query(
            `
          SELECT
            i.data_operacao AS data,
            i.numero_cupom,
            i.descricao_item,
            i.codigo_setor,
            i.quantidade,
            GREATEST(
              0,
              i.valor_liquido_item - COALESCE(i.valor_desconto_varejo, 0)
            ) AS valor
          FROM caixa_itens_erp i
          INNER JOIN caixa_pagamentos_erp p ON p.id = i.pagamento_id
          WHERE i.tipo_item = 'PRODUTO'
            AND i.unidade = $1
            AND i.data_operacao >= $2
            AND i.data_operacao <= $3
            AND p.codigo_operador_caixa = $4
            AND i.codigo_setor = ANY($5::int[])
          ORDER BY i.data_operacao ASC, i.numero_cupom ASC, i.sequencia_item ASC
        `,
            [
              dto.unidade,
              periodo.dataInicial,
              tetoManip,
              codigo,
              setoresRevenda,
            ],
          ) as Promise<
            Array<{
              data: string | Date;
              numero_cupom: string | number;
              descricao_item: string | null;
              codigo_setor: string | number | null;
              quantidade: string | number;
              valor: string | number;
            }>
          >)
        : Promise.resolve([]),
    ]);

    return {
      funcionarioId: funcionario.id,
      nomeVendedor: funcionario.nome,
      codigoVendedorErp: codigo,
      isTotal: false,
      manipulados: reqRows.map((row) => ({
        data: this.toYmd(row.data),
        numeroCupom: this.toInt(row.numero_cupom),
        numeroRequisicao: this.toInt(row.numero_requisicao),
        valor: this.round2(this.toNumber(row.valor)),
      })),
      setor: setorRows.map((row) => ({
        data: this.toYmd(row.data),
        numeroCupom: this.toInt(row.numero_cupom),
        descricaoItem: row.descricao_item,
        codigoSetor:
          row.codigo_setor == null ? null : this.toInt(row.codigo_setor),
        quantidade: this.toNumber(row.quantidade),
        valor: this.round2(this.toNumber(row.valor)),
      })),
      marcaPropria: mpRows.map((row) => ({
        data: this.toYmd(row.data),
        numeroCupom: this.toInt(row.numero_cupom),
        descricaoItem: row.descricao_item,
        quantidade: this.toNumber(row.quantidade),
        valor: this.round2(this.toNumber(row.valor)),
      })),
      rejeitados: rejRows.map((row) => ({
        dataOrcamento: this.toYmd(row.data_orcamento),
        nrOrcamento: row.nr_orcamento || '—',
        nomeCliente: row.nome_cliente,
        precoVenda: this.round2(this.toNumber(row.preco_venda)),
        motivoRejeicao: row.motivo_rejeicao,
      })),
      terceiros: tercRows.map((row) => ({
        dataBaixa: this.toYmd(row.data_baixa),
        protocolo: row.protocolo || '—',
        dataVenda: row.data_venda ? this.toYmd(row.data_venda) : null,
        nomeCliente: row.nome_cliente,
        valor: this.round2(this.toNumber(row.valor)),
      })),
    };
  }

  private async detalheUnidade(
    dto: FindComercialAcompanhamentoDetalheDto,
  ): Promise<ComercialAcompanhamentoDetalheDto> {
    const periodo = periodoCompetencia(dto.ano, dto.mes);
    const ultimaConfirmada = await this.buscarUltimaDataCaixaConfirmada(
      dto.unidade,
    );
    const tetoManip = this.dataTetoCaixaConfirmado(
      periodo.dataInicial,
      periodo.dataFinal,
      ultimaConfirmada,
    );
    const politicaUnidade = await this.politicaUnidadeRepo.findOne({
      where: { unidade: dto.unidade },
    });
    const setoresMp = this.normalizarCodigosSetor(
      politicaUnidade?.codigosSetor,
    );
    const setoresRevenda = this.normalizarCodigosSetor(
      politicaUnidade?.codigosSetorRevendaManipulados,
    );
    const vinculoSql = `
      c.codigo_vendedor IN (
        SELECT f."codigoVendedorErp"
        FROM funcionarios f
        WHERE f.unidade = $1
          AND f."codigoVendedorErp" IS NOT NULL
          AND f."codigoVendedorErp" > 0
      )
    `;
    const filtroMpSql =
      setoresMp.length > 0 ? ' AND i.codigo_setor = ANY($4::int[])' : '';
    const paramsMp = setoresMp.length
      ? [dto.unidade, periodo.dataInicial, tetoManip ?? periodo.dataFinal, setoresMp]
      : [dto.unidade, periodo.dataInicial, tetoManip ?? periodo.dataFinal];

    const [reqRows, mpRows, rejRows, tercRows, setorRows] = await Promise.all([
      tetoManip
        ? (this.dataSource.query(
            `
          SELECT
            t.data,
            t.numero_cupom,
            t.numero_requisicao,
            t.valor
          FROM (
            SELECT
              MIN(i.data_operacao) AS data,
              i.numero_cupom,
              i.numero_requisicao,
              GREATEST(
                0,
                LEAST(
                  SUM(i.valor_liquido_item - COALESCE(i.valor_taxa, 0)),
                  MAX(
                    COALESCE(
                      c.valor_pago_requisicao - COALESCE(c.valor_taxa, 0),
                      i.valor_liquido_item - COALESCE(i.valor_taxa, 0)
                    )
                  )
                )
              ) AS valor
            FROM caixa_itens_erp i
            INNER JOIN caixa_pagamentos_erp p ON p.id = i.pagamento_id
            ${this.sqlJoinCaixaPago()}
            WHERE i.tipo_item = 'REQUISICAO'
              AND i.unidade = $1
              AND i.numero_requisicao IS NOT NULL
              AND i.data_operacao >= $2
              AND i.data_operacao <= $3
              AND COALESCE(c.tipo_requisicao, '') <> 'C'
              AND ${vinculoSql}
            GROUP BY i.numero_cupom, i.numero_requisicao
            UNION ALL
            SELECT
              c.data_pagamento AS data,
              c.numero_cupom,
              c.numero_requisicao,
              GREATEST(
                0,
                COALESCE(c.valor_pago_requisicao, 0) - COALESCE(c.valor_taxa, 0)
              ) AS valor
            FROM caixa_requisicoes_pagas c
            WHERE c.unidade = $1
              AND c.data_pagamento >= $2
              AND c.data_pagamento <= $3
              AND COALESCE(c.tipo_requisicao, '') <> 'C'
              AND ${vinculoSql}
              AND ${this.sqlPagaSemItemComPagamento('c')}
          ) t
          ORDER BY t.data ASC, t.numero_cupom ASC, t.numero_requisicao ASC
        `,
            [dto.unidade, periodo.dataInicial, tetoManip],
          ) as Promise<
            Array<{
              data: string | Date;
              numero_cupom: string | number;
              numero_requisicao: string | number;
              valor: string | number;
            }>
          >)
        : Promise.resolve([]),
      this.dataSource.query(
        setoresMp.length
          ? `
          SELECT
            i.data_operacao AS data,
            i.numero_cupom,
            i.descricao_item,
            i.quantidade,
            GREATEST(
              0,
              i.valor_liquido_item - COALESCE(i.valor_desconto_varejo, 0)
            ) AS valor
          FROM caixa_itens_erp i
          INNER JOIN caixa_pagamentos_erp p ON p.id = i.pagamento_id
          WHERE i.tipo_item = 'PRODUTO'
            AND i.unidade = $1
            AND i.data_operacao >= $2
            AND i.data_operacao <= $3
            ${filtroMpSql}
          ORDER BY i.data_operacao ASC, i.numero_cupom ASC, i.sequencia_item ASC
        `
          : `
          SELECT
            i.data_operacao AS data,
            i.numero_cupom,
            i.descricao_item,
            i.quantidade,
            i.valor_liquido_item AS valor
          FROM caixa_itens_erp i
          WHERE i.tipo_item = 'PRODUTO'
            AND i.unidade = $1
            AND i.data_operacao >= $2
            AND i.data_operacao <= $3
          ORDER BY i.data_operacao ASC, i.numero_cupom ASC, i.sequencia_item ASC
        `,
        paramsMp,
      ) as Promise<
        Array<{
          data: string | Date;
          numero_cupom: string | number;
          descricao_item: string | null;
          quantidade: string | number;
          valor: string | number;
        }>
      >,
      this.dataSource.query(
        `
          SELECT
            o."dataOrcamento" AS data_orcamento,
            o."nrOrcamento" AS nr_orcamento,
            o."nomeCliente" AS nome_cliente,
            o."precoVenda" AS preco_venda,
            m.descricao AS motivo_rejeicao
          FROM orcamentos o
          LEFT JOIN orcamento_motivo_rejeicao m ON m.id = o."motivoRejeicaoId"
          WHERE o.unidade = $1
            AND o.status = 'REJEITADO'
            AND o."dataOrcamento" >= $2
            AND o."dataOrcamento" <= $3
            AND o."codigoVendedor" IS NOT NULL
          ORDER BY o."dataOrcamento" ASC, o."nrOrcamento" ASC
        `,
        [dto.unidade, periodo.dataInicial, periodo.dataFinal],
      ) as Promise<
        Array<{
          data_orcamento: string | Date;
          nr_orcamento: string;
          nome_cliente: string | null;
          preco_venda: string | number;
          motivo_rejeicao: string | null;
        }>
      >,
      tetoManip
        ? (this.dataSource.query(
            `
          SELECT
            b."dataBaixa" AS data_baixa,
            v.protocolo,
            v."dataVenda" AS data_venda,
            c.nome AS nome_cliente,
            CAST(b."valorBaixa" AS NUMERIC) AS valor
          FROM baixas b
          INNER JOIN vendas v ON v.id = b.idvenda
          LEFT JOIN clientes c ON c.id = v."clienteId"
          WHERE v.unidade = $1
            AND b."dataBaixa" >= $2
            AND b."dataBaixa" <= $3
          ORDER BY b."dataBaixa" ASC, v.protocolo ASC
        `,
            [dto.unidade, periodo.dataInicial, tetoManip],
          ) as Promise<
            Array<{
              data_baixa: string | Date;
              protocolo: string;
              data_venda: string | Date | null;
              nome_cliente: string | null;
              valor: string | number;
            }>
          >)
        : Promise.resolve([]),
      tetoManip && setoresRevenda.length
        ? (this.dataSource.query(
            `
          SELECT
            i.data_operacao AS data,
            i.numero_cupom,
            i.descricao_item,
            i.codigo_setor,
            i.quantidade,
            GREATEST(
              0,
              i.valor_liquido_item - COALESCE(i.valor_desconto_varejo, 0)
            ) AS valor
          FROM caixa_itens_erp i
          INNER JOIN caixa_pagamentos_erp p ON p.id = i.pagamento_id
          WHERE i.tipo_item = 'PRODUTO'
            AND i.unidade = $1
            AND i.data_operacao >= $2
            AND i.data_operacao <= $3
            AND i.codigo_setor = ANY($4::int[])
          ORDER BY i.data_operacao ASC, i.numero_cupom ASC, i.sequencia_item ASC
        `,
            [dto.unidade, periodo.dataInicial, tetoManip, setoresRevenda],
          ) as Promise<
            Array<{
              data: string | Date;
              numero_cupom: string | number;
              descricao_item: string | null;
              codigo_setor: string | number | null;
              quantidade: string | number;
              valor: string | number;
            }>
          >)
        : Promise.resolve([]),
    ]);

    return {
      funcionarioId: null,
      nomeVendedor: `TOTAL ${dto.unidade}`,
      codigoVendedorErp: null,
      isTotal: true,
      manipulados: reqRows.map((row) => ({
        data: this.toYmd(row.data),
        numeroCupom: this.toInt(row.numero_cupom),
        numeroRequisicao: this.toInt(row.numero_requisicao),
        valor: this.round2(this.toNumber(row.valor)),
      })),
      setor: setorRows.map((row) => ({
        data: this.toYmd(row.data),
        numeroCupom: this.toInt(row.numero_cupom),
        descricaoItem: row.descricao_item,
        codigoSetor:
          row.codigo_setor == null ? null : this.toInt(row.codigo_setor),
        quantidade: this.toNumber(row.quantidade),
        valor: this.round2(this.toNumber(row.valor)),
      })),
      marcaPropria: mpRows.map((row) => ({
        data: this.toYmd(row.data),
        numeroCupom: this.toInt(row.numero_cupom),
        descricaoItem: row.descricao_item,
        quantidade: this.toNumber(row.quantidade),
        valor: this.round2(this.toNumber(row.valor)),
      })),
      rejeitados: rejRows.map((row) => ({
        dataOrcamento: this.toYmd(row.data_orcamento),
        nrOrcamento: row.nr_orcamento || '—',
        nomeCliente: row.nome_cliente,
        precoVenda: this.round2(this.toNumber(row.preco_venda)),
        motivoRejeicao: row.motivo_rejeicao,
      })),
      terceiros: tercRows.map((row) => ({
        dataBaixa: this.toYmd(row.data_baixa),
        protocolo: row.protocolo || '—',
        dataVenda: row.data_venda ? this.toYmd(row.data_venda) : null,
        nomeCliente: row.nome_cliente,
        valor: this.round2(this.toNumber(row.valor)),
      })),
    };
  }

  private montarItem(
    funcionarioId: string | null,
    nome: string,
    codigo: number,
    reqMap: MapaMovimento,
    mpMap: MapaMovimento,
    rejMap: MapaMovimento,
    revendaMap: MapaMovimento,
    setoresRevenda: number[],
    terceirosPorCodigo: Map<number, { valor: number; qtd: number }>,
  ): ComercialAcompanhamentoItemDto {
    const req = reqMap.get(codigo);
    const mp = mpMap.get(codigo);
    const rej = rejMap.get(codigo);
    const revenda = setoresRevenda.length ? revendaMap.get(codigo) : undefined;
    const terceiros = terceirosPorCodigo.get(codigo);
    const valorPura = this.round2(req?.valor ?? 0);
    const valorRevenda = this.round2(revenda?.valor ?? 0);
    const valorTerceiros = this.round2(terceiros?.valor ?? 0);
    const comissaoBase = this.round2(valorPura + valorRevenda);
    return {
      funcionarioId,
      nomeVendedor: nome,
      codigoVendedorErp: codigo,
      valorRequisicaoPura: valorPura,
      valorRevendaManipulados: valorRevenda,
      quantidadeRevendaManipulados: revenda?.qtd ?? 0,
      codigosSetorRevendaManipulados: setoresRevenda,
      valorTerceirosManipulados: valorTerceiros,
      quantidadeTerceirosManipulados: terceiros?.qtd ?? 0,
      valorComissaoBaseRequisicao: comissaoBase,
      valorRecebidoRequisicao: this.round2(comissaoBase + valorTerceiros),
      quantidadeRecebidoRequisicao: req?.qtd ?? 0,
      quantidadeFormulasRequisicao: req?.qtdFormulas ?? 0,
      valorRecebidoMarcaPropria: mp?.valor ?? 0,
      quantidadeRecebidoMarcaPropria: mp?.qtd ?? 0,
      valorRejeitado: rej?.valor ?? 0,
      quantidadeRejeitado: rej?.qtd ?? 0,
    };
  }

  private somarTotais(
    itens: ComercialAcompanhamentoItemDto[],
  ): ComercialAcompanhamentoTotaisDto {
    return itens.reduce(
      (acc, i) => ({
        valorRecebidoRequisicao:
          acc.valorRecebidoRequisicao + i.valorRequisicaoPura,
        valorRequisicaoPura: acc.valorRequisicaoPura + i.valorRequisicaoPura,
        valorRevendaManipulados: acc.valorRevendaManipulados,
        quantidadeRevendaManipulados: acc.quantidadeRevendaManipulados,
        valorTerceirosManipulados: acc.valorTerceirosManipulados,
        quantidadeTerceirosManipulados: acc.quantidadeTerceirosManipulados,
        valorComissaoBaseRequisicao: acc.valorComissaoBaseRequisicao,
        quantidadeRecebidoRequisicao:
          acc.quantidadeRecebidoRequisicao + i.quantidadeRecebidoRequisicao,
        quantidadeFormulasRequisicao:
          acc.quantidadeFormulasRequisicao + i.quantidadeFormulasRequisicao,
        valorRecebidoMarcaPropria:
          acc.valorRecebidoMarcaPropria + i.valorRecebidoMarcaPropria,
        quantidadeRecebidoMarcaPropria:
          acc.quantidadeRecebidoMarcaPropria + i.quantidadeRecebidoMarcaPropria,
        valorRejeitado: acc.valorRejeitado + i.valorRejeitado,
        quantidadeRejeitado: acc.quantidadeRejeitado + i.quantidadeRejeitado,
        quantidadeVendedores: acc.quantidadeVendedores + (i.funcionarioId ? 1 : 0),
        codigosSetorMarcaPropria: acc.codigosSetorMarcaPropria,
        valorRecebidoMarcaPropriaSetores:
          acc.valorRecebidoMarcaPropriaSetores,
        quantidadeRecebidoMarcaPropriaSetores:
          acc.quantidadeRecebidoMarcaPropriaSetores,
      }),
      {
        valorRecebidoRequisicao: 0,
        valorRequisicaoPura: 0,
        valorRevendaManipulados: 0,
        quantidadeRevendaManipulados: 0,
        valorTerceirosManipulados: 0,
        quantidadeTerceirosManipulados: 0,
        valorComissaoBaseRequisicao: 0,
        quantidadeRecebidoRequisicao: 0,
        quantidadeFormulasRequisicao: 0,
        valorRecebidoMarcaPropria: 0,
        quantidadeRecebidoMarcaPropria: 0,
        valorRejeitado: 0,
        quantidadeRejeitado: 0,
        quantidadeVendedores: 0,
        codigosSetorMarcaPropria: [],
        valorRecebidoMarcaPropriaSetores: 0,
        quantidadeRecebidoMarcaPropriaSetores: 0,
      },
    );
  }

  /**
   * Manipulados do vendedor (RN-COM-003): Terminal de Caixa —
   * data_operacao + item com pagamento; Taxa=Não →
   * LEAST(SUM(item−taxa), paga−taxa) por cupom+req.
   * União: paga sem item no terminal (data_pagamento, pago−taxa).
   * qtd = cupom+req; qtd_formulas = linhas de item / quantidade_formulas.
   */
  private async buscarRecebidoRequisicao(
    unidade: Unidade,
    dataInicial: string,
    dataFinal: string,
  ): Promise<MapaMovimento> {
    const sql = `
      WITH por_req AS (
        SELECT
          c.codigo_vendedor,
          MAX(c.nome_vendedor) AS nome_vendedor,
          i.numero_cupom,
          i.numero_requisicao,
          GREATEST(
            0,
            LEAST(
              SUM(i.valor_liquido_item - COALESCE(i.valor_taxa, 0)),
              MAX(
                COALESCE(
                  c.valor_pago_requisicao - COALESCE(c.valor_taxa, 0),
                  i.valor_liquido_item - COALESCE(i.valor_taxa, 0)
                )
              )
            )
          ) AS valor_recebido,
          GREATEST(
            COALESCE(MAX(c.quantidade_formulas), 0),
            COUNT(*)
          )::int AS qtd_formulas
        FROM caixa_itens_erp i
        INNER JOIN caixa_pagamentos_erp p ON p.id = i.pagamento_id
        ${this.sqlJoinCaixaPago()}
        WHERE i.tipo_item = 'REQUISICAO'
          AND i.unidade = $1
          AND i.numero_requisicao IS NOT NULL
          AND i.data_operacao >= $2
          AND i.data_operacao <= $3
          AND COALESCE(c.tipo_requisicao, '') <> 'C'
          AND c.codigo_vendedor IS NOT NULL
          AND c.codigo_vendedor > 0
        GROUP BY c.codigo_vendedor, i.numero_cupom, i.numero_requisicao
        UNION ALL
        SELECT
          c.codigo_vendedor,
          MAX(c.nome_vendedor) AS nome_vendedor,
          c.numero_cupom,
          c.numero_requisicao,
          GREATEST(
            0,
            COALESCE(MAX(c.valor_pago_requisicao), 0)
              - COALESCE(MAX(c.valor_taxa), 0)
          ) AS valor_recebido,
          GREATEST(COALESCE(MAX(c.quantidade_formulas), 0), 1)::int AS qtd_formulas
        FROM caixa_requisicoes_pagas c
        WHERE c.unidade = $1
          AND c.data_pagamento >= $2
          AND c.data_pagamento <= $3
          AND COALESCE(c.tipo_requisicao, '') <> 'C'
          AND c.codigo_vendedor IS NOT NULL
          AND c.codigo_vendedor > 0
          AND ${this.sqlPagaSemItemComPagamento('c')}
        GROUP BY c.codigo_vendedor, c.numero_cupom, c.numero_requisicao
      )
      SELECT codigo_vendedor,
             MAX(nome_vendedor) AS nome_vendedor,
             SUM(valor_recebido) AS valor,
             COUNT(*) AS qtd,
             SUM(qtd_formulas) AS qtd_formulas
      FROM por_req
      GROUP BY codigo_vendedor
    `;
    const rows = (await this.dataSource.query(sql, [
      unidade,
      dataInicial,
      dataFinal,
    ])) as MovimentoRow[];
    return this.mapMovimentoRows(rows);
  }

  /**
   * Revenda (PRODUTO) dos setores da política de Manipulados do vendedor.
   * Lista vazia na política = não entra (RN-COM-003).
   */
  private async buscarRecebidoRevendaManipulados(
    unidade: Unidade,
    dataInicial: string,
    dataFinal: string,
  ): Promise<MapaMovimento> {
    const sql = `
      SELECT p.codigo_operador_caixa AS codigo_vendedor,
             MAX(p.nome_operador_caixa) AS nome_vendedor,
             SUM(
               GREATEST(
                 0,
                 i.valor_liquido_item - COALESCE(i.valor_desconto_varejo, 0)
               )
             ) AS valor,
             SUM(i.quantidade) AS qtd
      FROM caixa_itens_erp i
      INNER JOIN caixa_pagamentos_erp p ON p.id = i.pagamento_id
      INNER JOIN LATERAL (
        SELECT f.id
        FROM funcionarios f
        WHERE f.unidade = i.unidade
          AND f."codigoVendedorErp" = p.codigo_operador_caixa
        ORDER BY f.id
        LIMIT 1
      ) f ON TRUE
      INNER JOIN comercial_comissao_politica pol
        ON pol."funcionarioId" = f.id
       AND pol."tipoBase" = 'REQUISICAO'
       AND COALESCE(cardinality(pol."codigosSetorRevendaManipulados"), 0) > 0
      WHERE i.tipo_item = 'PRODUTO'
        AND i.unidade = $1
        AND i.data_operacao >= $2
        AND i.data_operacao <= $3
        AND i.codigo_setor = ANY(pol."codigosSetorRevendaManipulados")
      GROUP BY p.codigo_operador_caixa
    `;
    const rows = (await this.dataSource.query(sql, [
      unidade,
      dataInicial,
      dataFinal,
    ])) as MovimentoRow[];
    return this.mapMovimentoRows(rows);
  }

  /**
   * Marca própria do card Total: recorte de setores da unidade (RN-COM-003 /
   * RN-COM-006) com a mesma fórmula dos vendedores; sem setores, todos os
   * PRODUTO do caixa. Manipulados do Total = soma das requisições dos
   * vendedores + revenda dos setores da unidade (se houver).
   */
  private async buscarVolumeLoja(
    unidade: Unidade,
    dataInicial: string,
    dataTeto: string,
    setoresUnidade: number[] = [],
    setoresRevendaManipulados: number[] = [],
  ): Promise<{
    marcaPropria: {
      valor: number;
      qtd: number;
      valorSetores: number;
      qtdSetores: number;
    };
    revendaManipulados: { valor: number; qtd: number };
  }> {
    const paramsPeriodo = [unidade, dataInicial, dataTeto];
    const [mpRows, mpSetoresRows, revendaRows] = await Promise.all([
      this.dataSource.query(
        `
          SELECT
            COALESCE(SUM(i.valor_liquido_item), 0) AS valor,
            COUNT(*)::int AS qtd
          FROM caixa_itens_erp i
          WHERE i.tipo_item = 'PRODUTO'
            AND i.unidade = $1
            AND i.data_operacao >= $2
            AND i.data_operacao <= $3
        `,
        paramsPeriodo,
      ) as Promise<
        Array<{ valor: string | number | null; qtd: string | number | null }>
      >,
      setoresUnidade.length
        ? (this.dataSource.query(
            `
              SELECT
                COALESCE(
                  SUM(
                    GREATEST(
                      0,
                      i.valor_liquido_item - COALESCE(i.valor_desconto_varejo, 0)
                    )
                  ),
                  0
                ) AS valor,
                COALESCE(SUM(i.quantidade), 0) AS qtd
              FROM caixa_itens_erp i
              INNER JOIN caixa_pagamentos_erp p ON p.id = i.pagamento_id
              WHERE i.tipo_item = 'PRODUTO'
                AND i.unidade = $1
                AND i.data_operacao >= $2
                AND i.data_operacao <= $3
                AND i.codigo_setor = ANY($4::int[])
            `,
            [...paramsPeriodo, setoresUnidade],
          ) as Promise<
            Array<{
              valor: string | number | null;
              qtd: string | number | null;
            }>
          >)
        : Promise.resolve([{ valor: 0, qtd: 0 }]),
      setoresRevendaManipulados.length
        ? (this.dataSource.query(
            `
              SELECT
                COALESCE(
                  SUM(
                    GREATEST(
                      0,
                      i.valor_liquido_item - COALESCE(i.valor_desconto_varejo, 0)
                    )
                  ),
                  0
                ) AS valor,
                COALESCE(SUM(i.quantidade), 0) AS qtd
              FROM caixa_itens_erp i
              INNER JOIN caixa_pagamentos_erp p ON p.id = i.pagamento_id
              WHERE i.tipo_item = 'PRODUTO'
                AND i.unidade = $1
                AND i.data_operacao >= $2
                AND i.data_operacao <= $3
                AND i.codigo_setor = ANY($4::int[])
            `,
            [...paramsPeriodo, setoresRevendaManipulados],
          ) as Promise<
            Array<{
              valor: string | number | null;
              qtd: string | number | null;
            }>
          >)
        : Promise.resolve([{ valor: 0, qtd: 0 }]),
    ]);

    return {
      marcaPropria: {
        valor: this.round2(this.toNumber(mpRows[0]?.valor)),
        qtd: this.toInt(mpRows[0]?.qtd),
        valorSetores: this.round2(this.toNumber(mpSetoresRows[0]?.valor)),
        qtdSetores: this.toInt(mpSetoresRows[0]?.qtd),
      },
      revendaManipulados: {
        valor: this.round2(this.toNumber(revendaRows[0]?.valor)),
        qtd: this.toInt(revendaRows[0]?.qtd),
      },
    };
  }

  private async buscarUltimaDataCaixaConfirmada(
    unidade: Unidade,
  ): Promise<string | null> {
    const row = await this.caixaFechamentoRepo
      .createQueryBuilder('c')
      .select("MAX(TO_CHAR(c.dataOperacao, 'YYYY-MM-DD'))", 'ultima')
      .where('c.status = :status', {
        status: CaixaFechamentoStatus.CONFIRMADO,
      })
      .andWhere('c.unidade = :unidade', { unidade })
      .getRawOne<{ ultima: string | null }>();
    return row?.ultima ?? null;
  }

  /** Competência até o último caixa CONFIRMADO; sem confirmação no período, null. */
  private dataTetoCaixaConfirmado(
    dataInicial: string,
    dataFinal: string,
    ultimaConfirmada: string | null,
  ): string | null {
    if (!ultimaConfirmada || ultimaConfirmada < dataInicial) {
      return null;
    }
    return ultimaConfirmada < dataFinal ? ultimaConfirmada : dataFinal;
  }

  private async buscarRecebidoMarcaPropria(
    unidade: Unidade,
    dataInicial: string,
    dataFinal: string,
  ): Promise<MapaMovimento> {
    const sql = `
      SELECT p.codigo_operador_caixa AS codigo_vendedor,
             MAX(p.nome_operador_caixa) AS nome_vendedor,
             SUM(
               GREATEST(
                 0,
                 i.valor_liquido_item - COALESCE(i.valor_desconto_varejo, 0)
               )
             ) AS valor,
             SUM(i.quantidade) AS qtd
      FROM caixa_itens_erp i
      INNER JOIN caixa_pagamentos_erp p ON p.id = i.pagamento_id
      LEFT JOIN LATERAL (
        SELECT f.id
        FROM funcionarios f
        WHERE f.unidade = i.unidade
          AND f."codigoVendedorErp" = p.codigo_operador_caixa
        ORDER BY f.id
        LIMIT 1
      ) f ON TRUE
      LEFT JOIN comercial_comissao_politica pol
        ON pol."funcionarioId" = f.id
       AND pol."tipoBase" = 'MARCA_PROPRIA'
      WHERE i.tipo_item = 'PRODUTO'
        AND i.unidade = $1
        AND i.data_operacao >= $2
        AND i.data_operacao <= $3
        AND (
          pol."codigosSetor" IS NULL
          OR COALESCE(cardinality(pol."codigosSetor"), 0) = 0
          OR i.codigo_setor = ANY(pol."codigosSetor")
        )
      GROUP BY p.codigo_operador_caixa
    `;
    const rows = (await this.dataSource.query(sql, [
      unidade,
      dataInicial,
      dataFinal,
    ])) as MovimentoRow[];
    return this.mapMovimentoRows(rows);
  }

  /** Agrega orçamentos REJEITADO por vendedor. Colunas de `orcamentos` estão em camelCase. */
  private async buscarRejeitado(
    unidade: Unidade,
    dataInicial: string,
    dataFinal: string,
  ): Promise<MapaMovimento> {
    const sql = `
      SELECT "codigoVendedor" AS codigo_vendedor,
             MAX("nomeVendedor") AS nome_vendedor,
             SUM("precoVenda") AS valor,
             COUNT(*) AS qtd
      FROM orcamentos
      WHERE unidade = $1
        AND status = 'REJEITADO'
        AND "dataOrcamento" >= $2
        AND "dataOrcamento" <= $3
        AND "codigoVendedor" IS NOT NULL
      GROUP BY "codigoVendedor"
    `;
    const rows = (await this.dataSource.query(sql, [
      unidade,
      dataInicial,
      dataFinal,
    ])) as MovimentoRow[];
    return this.mapMovimentoRows(rows);
  }

  /**
   * Vendas de terceiro baixadas no caixa da unidade (RN-COM-003).
   * Eixo dataBaixa, até o último caixa CONFIRMADO. Valor = SUM(valorBaixa);
   * qtd = vendas distintas.
   */
  private async buscarRecebidoTerceiros(
    unidade: Unidade,
    dataInicial: string,
    dataFinal: string,
  ): Promise<{ valor: number; qtd: number }> {
    const rows = (await this.dataSource.query(
      `
        SELECT
          COALESCE(SUM(CAST(b."valorBaixa" AS NUMERIC)), 0) AS valor,
          COUNT(DISTINCT b.idvenda)::int AS qtd
        FROM baixas b
        INNER JOIN vendas v ON v.id = b.idvenda
        WHERE v.unidade = $1
          AND b."dataBaixa" >= $2
          AND b."dataBaixa" <= $3
      `,
      [unidade, dataInicial, dataFinal],
    )) as Array<{ valor: string | number | null; qtd: string | number | null }>;
    return {
      valor: this.round2(this.toNumber(rows[0]?.valor)),
      qtd: this.toInt(rows[0]?.qtd),
    };
  }

  /**
   * Terceiros do card do vendedor: venda.vendedor.cdVendedor =
   * funcionario.codigoVendedorErp na mesma unidade. O nome do card é o
   * do funcionário (RN-COM-003).
   */
  private async buscarRecebidoTerceirosPorVendedor(
    unidade: Unidade,
    dataInicial: string,
    dataFinal: string,
  ): Promise<Map<number, { valor: number; qtd: number }>> {
    const rows = (await this.dataSource.query(
      `
        SELECT
          f."codigoVendedorErp" AS codigo_vendedor,
          COALESCE(SUM(CAST(b."valorBaixa" AS NUMERIC)), 0) AS valor,
          COUNT(DISTINCT b.idvenda)::int AS qtd
        FROM baixas b
        INNER JOIN vendas v ON v.id = b.idvenda
        INNER JOIN vendedores ven ON ven.id = v."vendedorId"
        INNER JOIN funcionarios f
          ON f."codigoVendedorErp" = ven."cdVendedor"
         AND f.unidade = v.unidade::text
        WHERE v.unidade = $1
          AND b."dataBaixa" >= $2
          AND b."dataBaixa" <= $3
          AND ven."cdVendedor" IS NOT NULL
          AND ven."cdVendedor" > 0
          AND f."codigoVendedorErp" IS NOT NULL
          AND f."codigoVendedorErp" > 0
        GROUP BY f."codigoVendedorErp"
      `,
      [unidade, dataInicial, dataFinal],
    )) as Array<{
      codigo_vendedor: string | number | null;
      valor: string | number | null;
      qtd: string | number | null;
    }>;
    const map = new Map<number, { valor: number; qtd: number }>();
    for (const row of rows) {
      const codigo = this.toInt(row.codigo_vendedor);
      if (codigo <= 0) continue;
      map.set(codigo, {
        valor: this.round2(this.toNumber(row.valor)),
        qtd: this.toInt(row.qtd),
      });
    }
    return map;
  }

  private mapMovimentoRows(rows: MovimentoRow[]): MapaMovimento {
    const map: MapaMovimento = new Map();
    for (const row of rows) {
      const bruto = row.codigo_vendedor == null ? NaN : Number(row.codigo_vendedor);
      const codigo =
        Number.isFinite(bruto) && bruto > 0 ? bruto : CODIGO_SEM_VINCULO;
      const atual = map.get(codigo);
      const valor = this.toNumber(row.valor);
      const qtd = this.toInt(row.qtd);
      const qtdFormulas = this.toInt(row.qtd_formulas);
      if (atual) {
        atual.valor += valor;
        atual.qtd += qtd;
        atual.qtdFormulas += qtdFormulas;
        continue;
      }
      map.set(codigo, {
        nome: row.nome_vendedor?.trim() || NOME_SEM_VINCULO,
        valor,
        qtd,
        qtdFormulas,
      });
    }
    return map;
  }

  private async anexarDesempenho(
    itens: ComercialAcompanhamentoItemDto[],
    totais: ComercialAcompanhamentoTotaisDto,
    periodo: ReturnType<typeof periodoCompetencia>,
    unidade: Unidade,
    exporComissao: boolean,
    lojaRecebidoReq: number,
    lojaComissaoReq: number,
    lojaRecebidoMp: number,
    ultimaConfirmada: string | null,
  ): Promise<void> {
    const ids = [
      ...new Set(
        itens
          .map((i) => i.funcionarioId)
          .filter((id): id is string => !!id),
      ),
    ];
    const hoje = ymdHojeSp();
    const mesAberto = competenciaAberta(
      hoje,
      periodo.dataInicial,
      periodo.dataFinal,
    );

    const [metas, metasUnidade, faixas, politicas, calendario, feriados] =
      await Promise.all([
        ids.length
          ? this.metaRepo.find({
              where: {
                anoMes: periodo.anoMes,
                funcionario: { id: In(ids) },
              },
              relations: ['funcionario'],
            })
          : Promise.resolve([]),
        this.metaUnidadeRepo.find({
          where: { unidade, anoMes: periodo.anoMes },
        }),
        ids.length && exporComissao
          ? this.faixaRepo.find({
              where: { funcionario: { id: In(ids) } },
              relations: ['funcionario'],
            })
          : Promise.resolve([]),
        ids.length && exporComissao
          ? this.politicaRepo.find({
              where: { funcionario: { id: In(ids) } },
              relations: ['funcionario'],
            })
          : Promise.resolve([]),
        this.calendarioRepo.findOne({ where: { unidade } }),
        this.feriadoRepo
          .createQueryBuilder('f')
          .where('f.unidade = :unidade', { unidade })
          .andWhere('f.data >= :ini AND f.data <= :fim', {
            ini: periodo.dataInicial,
            fim: periodo.dataFinal,
          })
          .getMany(),
      ]);

    const metaReq = new Map<string, number>();
    const metaMp = new Map<string, number>();
    for (const m of metas) {
      const fid = m.funcionario?.id;
      if (!fid || m.valorMeta <= 0) continue;
      if (m.tipoBase === ComercialTipoBase.REQUISICAO) {
        metaReq.set(fid, Number(m.valorMeta));
      } else {
        metaMp.set(fid, Number(m.valorMeta));
      }
    }

    const faixasPorFuncTipo = new Map<string, ComercialComissaoFaixa[]>();
    for (const fx of faixas) {
      const fid = fx.funcionario?.id;
      if (!fid) continue;
      const chave = `${fid}|${fx.tipoBase}`;
      const lista = faixasPorFuncTipo.get(chave) ?? [];
      lista.push(fx);
      faixasPorFuncTipo.set(chave, lista);
    }

    const politicaPorFuncTipo = new Map<string, ComercialComissaoPolitica>();
    for (const p of politicas) {
      const fid = p.funcionario?.id;
      if (!fid) continue;
      politicaPorFuncTipo.set(`${fid}|${p.tipoBase}`, p);
    }

    const sabado = calendario?.sabadoDiaUtil ?? false;
    const feriadosSet = new Set(feriados.map((f) => f.data));
    const duMes = somarDiasUteisVisitacao(
      periodo.dataInicial,
      periodo.dataFinal,
      sabado,
      feriadosSet,
    );
    const realizados = somarDiasRealizadosVisitacao(
      periodo.dataInicial,
      periodo.dataFinal,
      ultimaConfirmada,
      sabado,
      feriadosSet,
    );

    totais.mesAberto = mesAberto;
    totais.diasUteisMes = duMes;
    totais.diasRealizados = realizados;

    let somaMetaReq = 0;
    let somaMetaMp = 0;

    for (const item of itens) {
      item.mesAberto = mesAberto;
      item.diasUteisMes = duMes;
      item.diasRealizados = realizados;
      const fid = item.funcionarioId;
      if (!fid) continue;

      const metaR = metaReq.get(fid);
      const metaM = metaMp.get(fid);
      if (mesAberto && realizados > 0) {
        item.valorProjetadoRequisicao = this.round2(
          (item.valorRecebidoRequisicao / realizados) * duMes,
        );
        item.valorProjetadoMarcaPropria = this.round2(
          (item.valorRecebidoMarcaPropria / realizados) * duMes,
        );
      }
      if (metaR != null) {
        item.valorMetaRequisicao = metaR;
        item.percentualMetaRequisicao =
          metaR > 0 ? (item.valorRecebidoRequisicao / metaR) * 100 : null;
        somaMetaReq += metaR;
        if (item.valorProjetadoRequisicao != null && metaR > 0) {
          item.percentualProjecaoRequisicao =
            (item.valorProjetadoRequisicao / metaR) * 100;
        }
      }
      if (metaM != null) {
        item.valorMetaMarcaPropria = metaM;
        item.percentualMetaMarcaPropria =
          metaM > 0 ? (item.valorRecebidoMarcaPropria / metaM) * 100 : null;
        somaMetaMp += metaM;
        if (item.valorProjetadoMarcaPropria != null && metaM > 0) {
          item.percentualProjecaoMarcaPropria =
            (item.valorProjetadoMarcaPropria / metaM) * 100;
        }
      }
    }

    let metaLojaReq: number | null = null;
    let metaLojaMp: number | null = null;
    for (const m of metasUnidade) {
      if (m.tipoBase === ComercialTipoBase.REQUISICAO) {
        metaLojaReq = Number(m.valorMeta);
      } else {
        metaLojaMp = Number(m.valorMeta);
      }
    }
    totais.valorMetaRequisicao = metaLojaReq ?? (somaMetaReq > 0 ? somaMetaReq : null);
    totais.percentualMetaRequisicao =
      totais.valorMetaRequisicao != null && totais.valorMetaRequisicao > 0
        ? (lojaRecebidoReq / totais.valorMetaRequisicao) * 100
        : null;
    totais.valorMetaMarcaPropria = metaLojaMp ?? (somaMetaMp > 0 ? somaMetaMp : null);
    totais.percentualMetaMarcaPropria =
      totais.valorMetaMarcaPropria != null && totais.valorMetaMarcaPropria > 0
        ? (lojaRecebidoMp / totais.valorMetaMarcaPropria) * 100
        : null;

    const lojaProjetadoReq =
      mesAberto && realizados > 0
        ? this.round2((lojaRecebidoReq / realizados) * duMes)
        : null;
    const lojaProjetadoComissaoReq =
      mesAberto && realizados > 0
        ? this.round2((lojaComissaoReq / realizados) * duMes)
        : null;
    const lojaProjetadoMp =
      mesAberto && realizados > 0
        ? this.round2((lojaRecebidoMp / realizados) * duMes)
        : null;
    const pctLojaProjReq =
      lojaProjetadoReq != null &&
      totais.valorMetaRequisicao != null &&
      totais.valorMetaRequisicao > 0
        ? (lojaProjetadoReq / totais.valorMetaRequisicao) * 100
        : null;
    const pctLojaProjMp =
      lojaProjetadoMp != null &&
      totais.valorMetaMarcaPropria != null &&
      totais.valorMetaMarcaPropria > 0
        ? (lojaProjetadoMp / totais.valorMetaMarcaPropria) * 100
        : null;

    totais.valorProjetadoRequisicao = lojaProjetadoReq;
    totais.percentualProjecaoRequisicao = pctLojaProjReq;
    totais.valorProjetadoMarcaPropria = lojaProjetadoMp;
    totais.percentualProjecaoMarcaPropria = pctLojaProjMp;

    if (!exporComissao) return;

    for (const item of itens) {
      const fid = item.funcionarioId;
      if (!fid) continue;
      const itemProjComissaoReq =
        mesAberto && realizados > 0
          ? this.round2(
              (item.valorComissaoBaseRequisicao / realizados) * duMes,
            )
          : null;
      this.anexarComissaoTipo(
        item,
        faixasPorFuncTipo.get(`${fid}|${ComercialTipoBase.REQUISICAO}`) ?? [],
        politicaPorFuncTipo.get(`${fid}|${ComercialTipoBase.REQUISICAO}`),
        item.percentualMetaRequisicao,
        item.percentualProjecaoRequisicao,
        item.valorComissaoBaseRequisicao,
        itemProjComissaoReq,
        totais.percentualMetaRequisicao,
        pctLojaProjReq,
        lojaComissaoReq,
        lojaProjetadoComissaoReq,
        'Requisicao',
      );
      this.anexarComissaoTipo(
        item,
        faixasPorFuncTipo.get(`${fid}|${ComercialTipoBase.MARCA_PROPRIA}`) ?? [],
        politicaPorFuncTipo.get(`${fid}|${ComercialTipoBase.MARCA_PROPRIA}`),
        item.percentualMetaMarcaPropria,
        item.percentualProjecaoMarcaPropria,
        item.valorRecebidoMarcaPropria,
        item.valorProjetadoMarcaPropria,
        totais.percentualMetaMarcaPropria,
        pctLojaProjMp,
        lojaRecebidoMp,
        lojaProjetadoMp,
        'MarcaPropria',
      );
    }
  }

  private anexarComissaoTipo(
    item: ComercialAcompanhamentoItemDto,
    faixas: ComercialComissaoFaixa[],
    politica: ComercialComissaoPolitica | undefined,
    percentualMetaPropria: number | null | undefined,
    percentualProjecaoPropria: number | null | undefined,
    valorProprio: number,
    valorProjetadoProprio: number | null | undefined,
    percentualMetaLoja: number | null | undefined,
    percentualProjecaoLoja: number | null | undefined,
    valorLoja: number,
    valorProjetadoLoja: number | null | undefined,
    sufixo: 'Requisicao' | 'MarcaPropria',
  ): void {
    const incidencia =
      politica?.incidencia ?? ComercialIncidenciaComissao.PROPRIAS;
    const minimoLoja =
      politica?.percentualMinimoLoja == null
        ? null
        : Number(politica.percentualMinimoLoja);
    const usaLoja = incidencia === ComercialIncidenciaComissao.LOJA;
    const percentualMeta = usaLoja
      ? percentualMetaLoja
      : percentualMetaPropria;
    const percentualProjecao = usaLoja
      ? percentualProjecaoLoja
      : percentualProjecaoPropria;
    const valorBase = usaLoja ? valorLoja : valorProprio;
    const valorProjetado = usaLoja ? valorProjetadoLoja : valorProjetadoProprio;
    const travaOk =
      minimoLoja == null || minimoLoja <= 0
        ? true
        : percentualMetaLoja != null && percentualMetaLoja + 1e-9 >= minimoLoja;
    const travaProjOk =
      minimoLoja == null || minimoLoja <= 0
        ? true
        : percentualProjecaoLoja != null &&
          percentualProjecaoLoja + 1e-9 >= minimoLoja;

    if (percentualMeta != null && travaOk) {
      const faixa = this.resolverFaixaComissao(faixas, percentualMeta);
      if (faixa) {
        const pct = Number(faixa.percentualComissao);
        const bonus = this.round2(Number(faixa.valorBonus ?? 0));
        const valor = this.round2((valorBase * pct) / 100);
        if (sufixo === 'Requisicao') {
          item.percentualComissaoFaixaRequisicao = pct;
          item.valorBonusRequisicao = bonus;
          item.valorComissaoRequisicao = valor;
        } else {
          item.percentualComissaoFaixaMarcaPropria = pct;
          item.valorBonusMarcaPropria = bonus;
          item.valorComissaoMarcaPropria = valor;
        }
      }
    } else if (percentualMeta != null && !travaOk) {
      if (sufixo === 'Requisicao') {
        item.percentualComissaoFaixaRequisicao = 0;
        item.valorBonusRequisicao = 0;
        item.valorComissaoRequisicao = 0;
      } else {
        item.percentualComissaoFaixaMarcaPropria = 0;
        item.valorBonusMarcaPropria = 0;
        item.valorComissaoMarcaPropria = 0;
      }
    }

    if (percentualProjecao != null && valorProjetado != null && travaProjOk) {
      const faixaProj = this.resolverFaixaComissao(faixas, percentualProjecao);
      if (faixaProj) {
        const pctProj = Number(faixaProj.percentualComissao);
        const bonusProj = this.round2(Number(faixaProj.valorBonus ?? 0));
        const valorProj = this.round2((valorProjetado * pctProj) / 100);
        if (sufixo === 'Requisicao') {
          item.percentualComissaoFaixa = pctProj;
          item.percentualComissaoFaixaProjetadoRequisicao = pctProj;
          item.valorBonusProjetadoRequisicao = bonusProj;
          item.valorComissaoProjetadoRequisicao = valorProj;
        } else {
          item.percentualComissaoFaixaProjetadoMarcaPropria = pctProj;
          item.valorBonusProjetadoMarcaPropria = bonusProj;
          item.valorComissaoProjetadoMarcaPropria = valorProj;
        }
      }
    } else if (
      percentualProjecao != null &&
      valorProjetado != null &&
      !travaProjOk
    ) {
      if (sufixo === 'Requisicao') {
        item.percentualComissaoFaixaProjetadoRequisicao = 0;
        item.valorBonusProjetadoRequisicao = 0;
        item.valorComissaoProjetadoRequisicao = 0;
      } else {
        item.percentualComissaoFaixaProjetadoMarcaPropria = 0;
        item.valorBonusProjetadoMarcaPropria = 0;
        item.valorComissaoProjetadoMarcaPropria = 0;
      }
    }
  }

  private somarMapa(map: MapaMovimento): { valor: number; qtd: number } {
    let valor = 0;
    let qtd = 0;
    for (const item of map.values()) {
      valor += item.valor;
      qtd += item.qtd;
    }
    return { valor, qtd };
  }

  private resolverFaixaComissao(
    faixas: ComercialComissaoFaixa[],
    percentualMeta: number,
  ): ComercialComissaoFaixa | null {
    const ordenadas = [...faixas].sort(
      (a, b) => Number(a.percentualMetaDe) - Number(b.percentualMetaDe),
    );
    for (const faixa of ordenadas) {
      const de = Number(faixa.percentualMetaDe);
      const ate =
        faixa.percentualMetaAte == null
          ? null
          : Number(faixa.percentualMetaAte);
      if (percentualMeta + 1e-9 < de) continue;
      if (ate != null && percentualMeta - 1e-9 > ate) continue;
      return faixa;
    }
    return null;
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

  /**
   * Paga sem item no terminal (ex. req 99774): o ERP credita o vendedor
   * pela FC17000 mesmo sem FC31200. Se já existe item REQUISICAO (mesmo sem
   * pagamento_id, ex. 100054), não entra por aqui — o card só conta item com
   * pagamento, como o relatório de comissão.
   */
  private sqlPagaSemItemComPagamento(alias: string): string {
    return `
            NOT EXISTS (
              SELECT 1
              FROM caixa_itens_erp i_ex
              WHERE i_ex.unidade = ${alias}.unidade
                AND i_ex.tipo_item = 'REQUISICAO'
                AND i_ex.numero_requisicao = ${alias}.numero_requisicao
            )`;
  }

  private normalizarCodigosSetor(
    lista: number[] | null | undefined,
  ): number[] {
    return (lista ?? [])
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n > 0);
  }

  private toYmd(value: string | Date | null | undefined): string {
    if (value == null || value === '') return '';
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    const s = String(value);
    return s.includes('T') ? s.split('T')[0] : s.slice(0, 10);
  }

  private toNumber(value: string | number | null | undefined): number {
    if (value == null || value === '') return 0;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private toInt(value: string | number | null | undefined): number {
    return Math.trunc(this.toNumber(value));
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
