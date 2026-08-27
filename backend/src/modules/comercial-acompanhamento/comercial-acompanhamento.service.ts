import { Injectable } from '@nestjs/common';
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
  ComercialAcompanhamentoItemDto,
  ComercialAcompanhamentoListResponseDto,
  ComercialAcompanhamentoTotaisDto,
  ComercialAcompanhamentoVendedorOpcaoDto,
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
};

type MapaMovimento = Map<
  number,
  { nome: string; valor: number; qtd: number }
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

    const [reqMap, mpMap, rejMap, vinculados] = await Promise.all([
      this.buscarRecebidoRequisicao(dto.unidade, periodo.dataInicial, periodo.dataFinal),
      this.buscarRecebidoMarcaPropria(dto.unidade, periodo.dataInicial, periodo.dataFinal),
      this.buscarRejeitado(dto.unidade, periodo.dataInicial, periodo.dataFinal),
      this.funcionarioRepo
        .createQueryBuilder('f')
        .where('f.unidade = :unidade', { unidade: dto.unidade })
        .andWhere('f.codigoVendedorErp IS NOT NULL')
        .andWhere('f.codigoVendedorErp > 0')
        .orderBy('f.nome', 'ASC')
        .getMany(),
    ]);

    let itens: ComercialAcompanhamentoItemDto[] = [];

    for (const f of vinculados) {
      if (dto.funcionarioId && f.id !== dto.funcionarioId) continue;
      const codigo = f.codigoVendedorErp!;
      itens.push(
        this.montarItem(f.id, f.nome, codigo, reqMap, mpMap, rejMap),
      );
    }

    itens = itens.sort(
      (a, b) =>
        b.valorRecebidoRequisicao +
        b.valorRecebidoMarcaPropria -
        (a.valorRecebidoRequisicao + a.valorRecebidoMarcaPropria),
    );

    const totais = this.somarTotais(itens);
    const lojaRecebidoReq = this.somarMapa(reqMap);
    const lojaRecebidoMp = this.somarMapa(mpMap);
    const lojaRejeitado = this.somarMapa(rejMap);
    if (!dto.funcionarioId) {
      totais.valorRecebidoRequisicao = lojaRecebidoReq.valor;
      totais.quantidadeRecebidoRequisicao = lojaRecebidoReq.qtd;
      totais.valorRecebidoMarcaPropria = lojaRecebidoMp.valor;
      totais.quantidadeRecebidoMarcaPropria = lojaRecebidoMp.qtd;
      totais.valorRejeitado = lojaRejeitado.valor;
      totais.quantidadeRejeitado = lojaRejeitado.qtd;
    }
    await this.anexarDesempenho(
      itens,
      totais,
      periodo,
      dto.unidade,
      exporComissao,
      lojaRecebidoReq.valor,
      lojaRecebidoMp.valor,
    );

    return {
      itens,
      totais,
      anoMes: periodo.anoMes,
      dataInicial: periodo.dataInicial,
      dataFinal: periodo.dataFinal,
    };
  }

  private montarItem(
    funcionarioId: string | null,
    nome: string,
    codigo: number,
    reqMap: MapaMovimento,
    mpMap: MapaMovimento,
    rejMap: MapaMovimento,
  ): ComercialAcompanhamentoItemDto {
    const req = reqMap.get(codigo);
    const mp = mpMap.get(codigo);
    const rej = rejMap.get(codigo);
    return {
      funcionarioId,
      nomeVendedor: nome,
      codigoVendedorErp: codigo,
      valorRecebidoRequisicao: req?.valor ?? 0,
      quantidadeRecebidoRequisicao: req?.qtd ?? 0,
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
          acc.valorRecebidoRequisicao + i.valorRecebidoRequisicao,
        quantidadeRecebidoRequisicao:
          acc.quantidadeRecebidoRequisicao + i.quantidadeRecebidoRequisicao,
        valorRecebidoMarcaPropria:
          acc.valorRecebidoMarcaPropria + i.valorRecebidoMarcaPropria,
        quantidadeRecebidoMarcaPropria:
          acc.quantidadeRecebidoMarcaPropria + i.quantidadeRecebidoMarcaPropria,
        valorRejeitado: acc.valorRejeitado + i.valorRejeitado,
        quantidadeRejeitado: acc.quantidadeRejeitado + i.quantidadeRejeitado,
        quantidadeVendedores: acc.quantidadeVendedores + (i.funcionarioId ? 1 : 0),
      }),
      {
        valorRecebidoRequisicao: 0,
        quantidadeRecebidoRequisicao: 0,
        valorRecebidoMarcaPropria: 0,
        quantidadeRecebidoMarcaPropria: 0,
        valorRejeitado: 0,
        quantidadeRejeitado: 0,
        quantidadeVendedores: 0,
      },
    );
  }

  private async buscarRecebidoRequisicao(
    unidade: Unidade,
    dataInicial: string,
    dataFinal: string,
  ): Promise<MapaMovimento> {
    const sql = `
      WITH linhas AS (
        SELECT DISTINCT ON (i.unidade, i.numero_cupom, COALESCE(i.numero_requisicao, 0))
          c.codigo_vendedor,
          c.nome_vendedor,
          ${this.sqlValorRecebidoPrescritor()} AS valor_recebido
        FROM caixa_itens_erp i
        ${this.sqlJoinCaixaPago()}
        WHERE i.tipo_item = 'REQUISICAO'
          AND i.unidade = $1
          ${this.sqlFiltroPeriodoRecebido('$2', '$3')}
          ${this.sqlFiltroRecebidoVisitacao()}
      )
      SELECT codigo_vendedor,
             MAX(nome_vendedor) AS nome_vendedor,
             SUM(valor_recebido) AS valor,
             COUNT(*) AS qtd
      FROM linhas
      GROUP BY codigo_vendedor
    `;
    const rows = (await this.dataSource.query(sql, [
      unidade,
      dataInicial,
      dataFinal,
    ])) as MovimentoRow[];
    return this.mapMovimentoRows(rows);
  }

  private async buscarRecebidoMarcaPropria(
    unidade: Unidade,
    dataInicial: string,
    dataFinal: string,
  ): Promise<MapaMovimento> {
    const sql = `
      SELECT p.codigo_operador_caixa AS codigo_vendedor,
             MAX(p.nome_operador_caixa) AS nome_vendedor,
             SUM(i.valor_liquido_item) AS valor,
             COUNT(*) AS qtd
      FROM caixa_itens_erp i
      INNER JOIN caixa_pagamentos_erp p ON p.id = i.pagamento_id
      WHERE i.tipo_item = 'PRODUTO'
        AND i.unidade = $1
        AND i.data_operacao >= $2
        AND i.data_operacao <= $3
        AND p.codigo_operador_caixa IS NOT NULL
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

  private mapMovimentoRows(rows: MovimentoRow[]): MapaMovimento {
    const map: MapaMovimento = new Map();
    for (const row of rows) {
      const bruto = row.codigo_vendedor == null ? NaN : Number(row.codigo_vendedor);
      const codigo =
        Number.isFinite(bruto) && bruto > 0 ? bruto : CODIGO_SEM_VINCULO;
      const atual = map.get(codigo);
      const valor = this.toNumber(row.valor);
      const qtd = this.toInt(row.qtd);
      if (atual) {
        atual.valor += valor;
        atual.qtd += qtd;
        continue;
      }
      map.set(codigo, {
        nome: row.nome_vendedor?.trim() || NOME_SEM_VINCULO,
        valor,
        qtd,
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
    lojaRecebidoMp: number,
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

    const [metas, metasUnidade, faixas, politicas, calendario, feriados, caixaFechado] =
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
        this.caixaFechamentoRepo
          .createQueryBuilder('c')
          .select("MAX(TO_CHAR(c.dataOperacao, 'YYYY-MM-DD'))", 'ultima')
          .where('c.status = :status', {
            status: CaixaFechamentoStatus.CONFIRMADO,
          })
          .andWhere('c.unidade = :unidade', { unidade })
          .getRawOne<{ ultima: string | null }>(),
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
    const ultimaConfirmada = caixaFechado?.ultima ?? null;
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
      this.anexarComissaoTipo(
        item,
        faixasPorFuncTipo.get(`${fid}|${ComercialTipoBase.REQUISICAO}`) ?? [],
        politicaPorFuncTipo.get(`${fid}|${ComercialTipoBase.REQUISICAO}`),
        item.percentualMetaRequisicao,
        item.percentualProjecaoRequisicao,
        item.valorRecebidoRequisicao,
        item.valorProjetadoRequisicao,
        totais.percentualMetaRequisicao,
        pctLojaProjReq,
        lojaRecebidoReq,
        lojaProjetadoReq,
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
          item.valorBonusProjetadoRequisicao = bonusProj;
          item.valorComissaoProjetadoRequisicao = valorProj;
        } else {
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
        item.valorBonusProjetadoRequisicao = 0;
        item.valorComissaoProjetadoRequisicao = 0;
      } else {
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

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
