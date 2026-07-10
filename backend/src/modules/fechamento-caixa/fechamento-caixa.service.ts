import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Unidade } from '../../common/enums/unidade.enum';
import {
  normalizarTextoLegado,
  padronizarNomeDeSistemaLegado,
} from '../../common/utils/encoding-legado.util';
import { Baixa } from '../baixas/entities/baixa.entity';
import { Cliente } from '../clientes/entities/cliente.entity';
import { Orcamento } from '../orcamentos/entities/orcamento.entity';
import {
  CaixaFormaTotalDto,
  ImportarCaixaErpResponseDto,
} from './dto/importar-caixa-erp-response.dto';
import { ImportarCaixaErpDto } from './dto/importar-caixa-erp.dto';
import { CaixaItemErp, CaixaTipoItem } from './entities/caixa-item-erp.entity';
import { CaixaPagamentoErp } from './entities/caixa-pagamento-erp.entity';
import { CaixaRequisicaoPaga } from './entities/caixa-requisicao-paga.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CaixaFechamento } from './entities/caixa-fechamento.entity';
import { CaixaFechamentoStatus } from './enums/caixa-fechamento-status.enum';
import {
  CaixaTerceiroOrigemTotalDto,
} from './dto/caixa-terceiro-origem-total.dto';
import {
  CaixaBaixaDetalheDto,
  CaixaErpPagamentoDetalheDto,
  FechamentoCaixaDetalhadoResponseDto,
} from './dto/fechamento-caixa-detalhado-response.dto';
import { normalizarDataIso } from '../../common/utils/data-date.util';
import {
  normalizarFormaErp,
  normalizarFormaTerceiro,
  formaBlocoFechamento,
} from './utils/caixa-forma.util';

interface AgenteConfig {
  url: string;
  token: string;
  unit: number;
}

interface AgenteCaixaPagamentoRow {
  data: string;
  cupom: number;
  cdtml: number;
  operid: number;
  fmpag: string;
  forma_pagamento: string;
  valor_bruto: number;
  troco: number;
  valor_liquido: number;
  total_cupom_bruto: number | null;
  total_cupom_liquido: number | null;
  cdcli: number | null;
  codigo_operador: number | null;
  operador_caixa: string | null;
}

interface AgenteCaixaItemRow {
  data: string;
  cupom: number;
  cdtml: number;
  operid: number;
  item_cupom: number;
  tipo_item: 'REQUISICAO' | 'PRODUTO';
  codigo_item: number | null;
  requisicao: number | null;
  descricao_item: string | null;
  quant: number;
  valor_item_bruto: number;
  valor_item_liquido: number;
  desconto_item: number;
  pagamento_cupom: number;
}

interface AgenteCaixaRequisicaoRow {
  data_pagamento: string;
  requisicao: number;
  cupom: number;
  nr_orcamento: number | null;
  qtd_formulas: number | null;
  valor_orcamento: number | null;
  valor_requisicao_bruto: number;
  desconto_requisicao: number;
  valor_pago_requisicao: number;
  diferenca_calculo: number;
  gap_orcamento_vs_pago: number | null;
  codigo_vendedor: number | null;
  vendedor: string | null;
}

@Injectable()
export class FechamentoCaixaService {
  private readonly logger = new Logger(FechamentoCaixaService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(CaixaPagamentoErp)
    private readonly pagamentoRepo: Repository<CaixaPagamentoErp>,
    @InjectRepository(CaixaItemErp)
    private readonly itemRepo: Repository<CaixaItemErp>,
    @InjectRepository(CaixaRequisicaoPaga)
    private readonly requisicaoRepo: Repository<CaixaRequisicaoPaga>,
    @InjectRepository(Orcamento)
    private readonly orcamentoRepo: Repository<Orcamento>,
    @InjectRepository(Baixa)
    private readonly baixaRepo: Repository<Baixa>,
    @InjectRepository(Cliente)
    private readonly clienteRepo: Repository<Cliente>,
    @InjectRepository(CaixaFechamento)
    private readonly fechamentoRepo: Repository<CaixaFechamento>,
  ) {}

  async importarCaixaErp(
    usuario: Usuario,
    dto: ImportarCaixaErpDto,
  ): Promise<ImportarCaixaErpResponseDto> {
    await this.validarImportacaoCaixaErp(usuario, dto);

    const agente = this.getAgenteConfig(dto.unidade);
    if (!agente?.url || !agente?.token) {
      throw new BadRequestException(
        `Agente não configurado para a unidade ${dto.unidade}.`,
      );
    }

    const body = {
      unit: agente.unit,
      start: dto.dataInicio,
      end: dto.dataFim,
    };

    this.logger.log(
      `Importando caixa ERP: unidade=${dto.unidade}, periodo=${dto.dataInicio}..${dto.dataFim}, cdfil=${agente.unit}`,
    );

    const [pagamentosResp, itensResp, requisicoesResp] = await Promise.all([
      this.chamarAgente<{ pagamentos: AgenteCaixaPagamentoRow[] }>(
        agente,
        '/api/v1/caixa/pagamentos',
        body,
      ),
      this.chamarAgente<{ itens: AgenteCaixaItemRow[] }>(
        agente,
        '/api/v1/caixa/itens',
        body,
      ),
      this.chamarAgente<{ requisicoes: AgenteCaixaRequisicaoRow[] }>(
        agente,
        '/api/v1/caixa/requisicoes-pagas',
        body,
      ),
    ]);

    const pagamentosStats = await this.upsertPagamentos(
      pagamentosResp.pagamentos ?? [],
      dto.unidade,
      true,
    );

    const pagamentoChaves = (pagamentosResp.pagamentos ?? []).map((p) =>
      this.buildChavePagamento(dto.unidade, p),
    );
    const pagamentoMap = await this.carregarMapaPagamentos(pagamentoChaves);

    const itensStats = await this.upsertItens(
      itensResp.itens ?? [],
      dto.unidade,
      dto.dataInicio,
      dto.dataFim,
      pagamentoMap,
      true,
    );

    const requisicoesStats = await this.upsertRequisicoes(
      requisicoesResp.requisicoes ?? [],
      dto.unidade,
      true,
    );

    const totaisPorForma = await this.obterTotaisPorForma(
      dto.unidade,
      dto.dataInicio,
      dto.dataFim,
    );
    const totaisErpNormalizados = this.normalizarTotaisErp(totaisPorForma);
    const totaisTerceiroDetalhe = await this.obterTotaisTerceiroDetalhe(
      dto.unidade,
      dto.dataInicio,
      dto.dataFim,
    );
    const totaisTerceiro = this.agregarTotaisTerceiroPorForma(
      totaisTerceiroDetalhe,
    );
    const totaisConsolidados = this.montarTotaisConsolidados(
      totaisErpNormalizados,
      totaisTerceiro,
    );

    const totalLiquido = this.somarLiquido(totaisPorForma);
    const totalLiquidoTerceiro = this.somarLiquido(totaisTerceiro);
    const totalConsolidado = this.somarLiquido(totaisConsolidados);

    return {
      dataInicio: dto.dataInicio,
      dataFim: dto.dataFim,
      unidade: dto.unidade,
      cdfil: agente.unit,
      pagamentosImportados: pagamentosStats.importados,
      pagamentosAtualizados: pagamentosStats.atualizados,
      itensImportados: itensStats.importados,
      itensAtualizados: itensStats.atualizados,
      requisicoesImportadas: requisicoesStats.importados,
      requisicoesAtualizadas: requisicoesStats.atualizados,
      totaisPorForma,
      totaisErpNormalizados,
      totaisTerceiro,
      totaisTerceiroDetalhe,
      totaisConsolidados,
      totalLiquido,
      totalLiquidoTerceiro,
      totalConsolidado,
    };
  }

  private async validarImportacaoCaixaErp(
    usuario: Usuario,
    dto: ImportarCaixaErpDto,
  ): Promise<void> {
    if (dto.dataInicio > dto.dataFim) {
      throw new BadRequestException(
        'dataInicio não pode ser posterior a dataFim.',
      );
    }

    const unidadeUsuario = usuario.unidade?.trim();
    if (unidadeUsuario && dto.unidade !== unidadeUsuario) {
      throw new ForbiddenException(
        'A importação só é permitida para a unidade do usuário logado.',
      );
    }

    await this.assertPodeAlterarDataCaixa(dto.unidade, dto.dataInicio);
  }

  async assertPodeAlterarDataCaixa(
    unidade: Unidade,
    data: string,
  ): Promise<void> {
    const dataNormalizada = normalizarDataIso(data) ?? data;
    const ultima = await this.obterUltimaDataFechamentoConfirmada(unidade);
    if (!ultima) {
      return;
    }
    if (dataNormalizada < ultima) {
      throw new ConflictException(
        'Não é possível alterar datas anteriores ao último fechamento confirmado da unidade. Utilize o último registro ou uma data posterior.',
      );
    }
  }

  async assertPodeRegistrarBaixa(
    unidade: Unidade,
    dataBaixa: string,
  ): Promise<void> {
    const dataNormalizada = normalizarDataIso(dataBaixa) ?? dataBaixa;
    const ultima = await this.obterUltimaDataFechamentoConfirmada(unidade);
    if (!ultima) {
      return;
    }
    if (dataNormalizada <= ultima) {
      const ultimaDataFormatada = this.formatDateDisplay(ultima);
      const mensagem =
        '<strong>Não foi possível realizar esta operação!</strong><br><br>' +
        `O caixa da unidade <strong>${unidade}</strong> foi fechado em <strong>${ultimaDataFormatada}</strong>.<br><br>` +
        'Só é permitido registrar, alterar ou excluir baixa com data posterior ao último fechamento da unidade.';
      throw new ConflictException(mensagem);
    }
  }

  async obterUltimaDataFechamentoConfirmada(
    unidade: Unidade,
  ): Promise<string | null> {
    const row = await this.fechamentoRepo
      .createQueryBuilder('f')
      .select("TO_CHAR(f.dataOperacao, 'YYYY-MM-DD')", 'data')
      .where('f.unidade = :unidade', { unidade })
      .andWhere('f.status = :status', {
        status: CaixaFechamentoStatus.CONFIRMADO,
      })
      .orderBy('f.dataOperacao', 'DESC')
      .getRawOne<{ data: string }>();
    return normalizarDataIso(row?.data);
  }

  private async chamarAgente<T>(
    agente: AgenteConfig,
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(`${agente.url}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${agente.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Erro desconhecido');
        throw new ServiceUnavailableException(
          `Erro ao consultar agente (${response.status}): ${errorText}`,
        );
      }

      return (await response.json()) as T;
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'Timeout ao consultar agente de caixa (120s).'
          : error instanceof Error
            ? error.message
            : 'Erro desconhecido ao consultar agente.';
      throw new ServiceUnavailableException(message);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private getAgenteConfig(unidade: Unidade): AgenteConfig | null {
    const agentes = this.configService.get<Record<string, AgenteConfig>>('agentes');
    if (!agentes) {
      return null;
    }

    switch (unidade) {
      case Unidade.INHUMAS:
        return agentes.inhumas ?? null;
      case Unidade.UBERABA:
        return agentes.uberaba ?? null;
      case Unidade.NERÓPOLIS:
        return agentes.neropolis ?? null;
      default:
        return null;
    }
  }

  private async upsertPagamentos(
    rows: AgenteCaixaPagamentoRow[],
    unidade: Unidade,
    atualizar: boolean,
  ): Promise<{ importados: number; atualizados: number }> {
    if (!rows.length) {
      return { importados: 0, atualizados: 0 };
    }

    const chaves = rows.map((r) => this.buildChavePagamento(unidade, r));
    const existentes = await this.pagamentoRepo.find({
      where: { chaveErp: In(chaves) },
      select: ['chaveErp'],
    });
    const existentesSet = new Set(existentes.map((e) => e.chaveErp));

    const entities = rows.map((row) =>
      this.pagamentoRepo.create({
        chaveErp: this.buildChavePagamento(unidade, row),
        unidade,
        dataOperacao: row.data,
        numeroCupom: row.cupom,
        codigoTerminal: row.cdtml,
        idOperacao: row.operid,
        formaPagamento: row.forma_pagamento,
        valorPago: row.valor_bruto,
        valorTroco: row.troco,
        valorLiquido: row.valor_liquido,
        totalCupomBruto: row.total_cupom_bruto,
        totalCupomLiquido: row.total_cupom_liquido,
        codigoCliente: row.cdcli,
        codigoOperadorCaixa: row.codigo_operador,
        nomeOperadorCaixa: row.operador_caixa
          ? padronizarNomeDeSistemaLegado(row.operador_caixa)
          : null,
        atualizadoEm: new Date(),
      }),
    );

    const entitiesUnicas = this.deduplicarPorChaveErp(entities, 'pagamentos');

    if (atualizar) {
      await this.pagamentoRepo.upsert(entitiesUnicas, ['chaveErp']);
    } else {
      const novos = entitiesUnicas.filter((e) => !existentesSet.has(e.chaveErp));
      if (novos.length) {
        await this.pagamentoRepo.save(novos);
      }
    }

    const chavesUnicas = entitiesUnicas.map((e) => e.chaveErp);
    return {
      importados: chavesUnicas.filter((c) => !existentesSet.has(c)).length,
      atualizados: chavesUnicas.filter((c) => existentesSet.has(c)).length,
    };
  }

  private async carregarMapaPagamentos(
    chaves: string[],
  ): Promise<Map<string, string>> {
    if (!chaves.length) {
      return new Map();
    }

    const pagamentos = await this.pagamentoRepo.find({
      where: { chaveErp: In(chaves) },
      select: ['id', 'chaveErp'],
    });

    return new Map(pagamentos.map((p) => [p.chaveErp, p.id]));
  }

  private async upsertItens(
    rows: AgenteCaixaItemRow[],
    unidade: Unidade,
    dataInicio: string,
    dataFim: string,
    pagamentoMap: Map<string, string>,
    atualizar: boolean,
  ): Promise<{ importados: number; atualizados: number }> {
    if (!rows.length) {
      return { importados: 0, atualizados: 0 };
    }

    const chaves = rows.map((r) => this.buildChaveItem(unidade, r));
    const existentes = await this.itemRepo.find({
      where: { chaveErp: In(chaves) },
      select: ['chaveErp'],
    });
    const existentesSet = new Set(existentes.map((e) => e.chaveErp));

    const pagamentosCupom = await this.pagamentoRepo.find({
      where: {
        unidade,
        dataOperacao: Between(dataInicio, dataFim),
      },
    });

    const entities = rows.map((row) => {
      const pagamentoId = this.resolverPagamentoId(
        unidade,
        row,
        pagamentosCupom,
        pagamentoMap,
      );

      return this.itemRepo.create({
        chaveErp: this.buildChaveItem(unidade, row),
        pagamentoId,
        unidade,
        dataOperacao: row.data,
        numeroCupom: row.cupom,
        codigoTerminal: row.cdtml,
        idOperacao: row.operid,
        sequenciaItem: row.item_cupom,
        tipoItem:
          row.tipo_item === 'REQUISICAO'
            ? CaixaTipoItem.REQUISICAO
            : CaixaTipoItem.PRODUTO,
        codigoRequisicaoProduto: row.codigo_item,
        numeroRequisicao: row.requisicao,
        descricaoItem: row.descricao_item
          ? normalizarTextoLegado(row.descricao_item)
          : null,
        quantidade: row.quant,
        valorBrutoItem: row.valor_item_bruto,
        valorLiquidoItem: row.valor_item_liquido,
        descontoItem: row.desconto_item,
        valorLiquidoLinha: row.pagamento_cupom,
        atualizadoEm: new Date(),
      });
    });

    const entitiesUnicas = this.deduplicarPorChaveErp(entities, 'itens');

    if (atualizar) {
      await this.itemRepo.upsert(entitiesUnicas, ['chaveErp']);
    } else {
      const novos = entitiesUnicas.filter((e) => !existentesSet.has(e.chaveErp));
      if (novos.length) {
        await this.itemRepo.save(novos);
      }
    }

    const chavesUnicas = entitiesUnicas.map((e) => e.chaveErp);
    return {
      importados: chavesUnicas.filter((c) => !existentesSet.has(c)).length,
      atualizados: chavesUnicas.filter((c) => existentesSet.has(c)).length,
    };
  }

  private resolverPagamentoId(
    unidade: Unidade,
    row: AgenteCaixaItemRow,
    pagamentosCupom: CaixaPagamentoErp[],
    pagamentoMap: Map<string, string>,
  ): string | null {
    const candidatos = pagamentosCupom.filter(
      (p) =>
        p.unidade === unidade &&
        p.dataOperacao === row.data &&
        p.numeroCupom === row.cupom &&
        p.codigoTerminal === row.cdtml &&
        p.idOperacao === row.operid,
    );

    if (candidatos.length === 1) {
      return candidatos[0].id;
    }

    if (candidatos.length > 1) {
      const porValor = candidatos.find(
        (p) =>
          Math.abs(Number(p.valorLiquido) - Number(row.pagamento_cupom)) < 0.01,
      );
      return porValor?.id ?? candidatos[0].id;
    }

    for (const [chave, id] of pagamentoMap.entries()) {
      if (
        chave.startsWith(
          `${unidade}-${row.cdtml}-${row.data}-${row.operid}-${row.cupom}-`,
        )
      ) {
        return id;
      }
    }

    return null;
  }

  private async upsertRequisicoes(
    rows: AgenteCaixaRequisicaoRow[],
    unidade: Unidade,
    atualizar: boolean,
  ): Promise<{ importados: number; atualizados: number }> {
    if (!rows.length) {
      return { importados: 0, atualizados: 0 };
    }

    const chaves = rows.map((r) => this.buildChaveRequisicao(unidade, r));
    const existentes = await this.requisicaoRepo.find({
      where: { chaveErp: In(chaves) },
      select: ['chaveErp'],
    });
    const existentesSet = new Set(existentes.map((e) => e.chaveErp));

    const nrOrcamentos = [
      ...new Set(
        rows
          .map((r) => r.nr_orcamento)
          .filter((n): n is number => n != null && n > 0),
      ),
    ];

    const orcamentos =
      nrOrcamentos.length > 0
        ? await this.orcamentoRepo.find({
            where: { unidade, nrorc: In(nrOrcamentos) },
            select: ['id', 'nrorc'],
          })
        : [];

    const orcamentoPorNr = new Map(orcamentos.map((o) => [o.nrorc, o.id]));

    const entities = rows.map((row) =>
      this.requisicaoRepo.create({
        chaveErp: this.buildChaveRequisicao(unidade, row),
        unidade,
        dataPagamento: row.data_pagamento,
        numeroRequisicao: row.requisicao,
        numeroCupom: row.cupom,
        numeroOrcamento: row.nr_orcamento,
        quantidadeFormulas: row.qtd_formulas,
        valorOrcamento: row.valor_orcamento,
        valorRequisicaoBruto: row.valor_requisicao_bruto,
        descontoRequisicao: row.desconto_requisicao,
        valorPagoRequisicao: row.valor_pago_requisicao,
        diferencaInternaRequisicao: row.diferenca_calculo,
        diferencaOrcamentoVsPago: row.gap_orcamento_vs_pago,
        codigoVendedor: row.codigo_vendedor,
        nomeVendedor: row.vendedor
          ? padronizarNomeDeSistemaLegado(row.vendedor)
          : null,
        orcamentoId:
          row.nr_orcamento != null
            ? orcamentoPorNr.get(row.nr_orcamento) ?? null
            : null,
        atualizadoEm: new Date(),
      }),
    );

    const entitiesUnicas = this.deduplicarPorChaveErp(entities, 'requisicoes');

    if (atualizar) {
      await this.requisicaoRepo.upsert(entitiesUnicas, ['chaveErp']);
    } else {
      const novos = entitiesUnicas.filter((e) => !existentesSet.has(e.chaveErp));
      if (novos.length) {
        await this.requisicaoRepo.save(novos);
      }
    }

    const chavesUnicas = entitiesUnicas.map((e) => e.chaveErp);
    return {
      importados: chavesUnicas.filter((c) => !existentesSet.has(c)).length,
      atualizados: chavesUnicas.filter((c) => existentesSet.has(c)).length,
    };
  }

  async obterTotaisPorFormaPublic(
    unidade: Unidade,
    dataInicio: string,
    dataFim: string,
  ): Promise<Record<string, CaixaFormaTotalDto>> {
    return this.obterTotaisPorForma(unidade, dataInicio, dataFim);
  }

  async obterCaixaDetalhado(
    unidade: Unidade,
    data: string,
  ): Promise<FechamentoCaixaDetalhadoResponseDto> {
    const dataNormalizada = normalizarDataIso(data) ?? data;

    const [baixas, erpPagamentos] = await Promise.all([
      this.obterBaixasDetalhe(unidade, dataNormalizada),
      this.obterPagamentosErpDetalhe(unidade, dataNormalizada),
    ]);

    const totalBaixas = Math.round(
      baixas.reduce((acc, item) => acc + item.valorBaixa, 0) * 100,
    ) / 100;
    const totalErpLiquido = Math.round(
      erpPagamentos.reduce((acc, item) => acc + item.valorLiquido, 0) * 100,
    ) / 100;

    return {
      unidade,
      data: dataNormalizada,
      baixas,
      erpPagamentos,
      totalBaixas,
      totalErpLiquido,
    };
  }

  private async obterBaixasDetalhe(
    unidade: Unidade,
    data: string,
  ): Promise<CaixaBaixaDetalheDto[]> {
    const rows = await this.baixaRepo
      .createQueryBuilder('b')
      .innerJoinAndSelect('b.venda', 'v')
      .leftJoinAndSelect('v.cliente', 'c')
      .where('v.unidade = :unidade', { unidade })
      .andWhere('b.dataBaixa = :data', { data })
      .orderBy('b.tipoDaBaixa', 'ASC')
      .addOrderBy('v.protocolo', 'ASC')
      .getMany();

    return rows.map((baixa) => ({
      protocolo: baixa.venda.protocolo,
      clienteNome: baixa.venda.cliente?.nome ?? null,
      origem: baixa.venda.origem,
      tipoDaBaixa: normalizarFormaTerceiro(baixa.tipoDaBaixa),
      valorBaixa: Number(baixa.valorBaixa),
      observacao: baixa.observacao ?? null,
      dataBaixa: normalizarDataIso(baixa.dataBaixa) ?? data,
    }));
  }

  private async obterPagamentosErpDetalhe(
    unidade: Unidade,
    data: string,
  ): Promise<CaixaErpPagamentoDetalheDto[]> {
    const rows = await this.pagamentoRepo.find({
      where: { unidade, dataOperacao: data },
      order: {
        numeroCupom: 'ASC',
        formaPagamento: 'ASC',
      },
    });

    const nomesClientes = await this.resolverNomesClientesPorCodigo(
      unidade,
      rows
        .map((pagamento) => pagamento.codigoCliente)
        .filter((codigo): codigo is number => codigo != null),
    );

    const numerosRequisicao = await this.resolverNumerosRequisicaoPorCupom(
      unidade,
      data,
      rows.map((pagamento) => pagamento.numeroCupom),
    );

    const descricoesProduto = await this.resolverDescricoesProdutoPorCupom(
      unidade,
      data,
      rows,
    );

    return rows.map((pagamento) => {
      const numeroRequisicao =
        numerosRequisicao.get(pagamento.numeroCupom) ?? null;
      const chaveCupom = this.buildChaveCupomOperacao(
        pagamento.numeroCupom,
        pagamento.codigoTerminal,
        pagamento.idOperacao,
      );

      return {
        numeroCupom: pagamento.numeroCupom,
        numeroRequisicao,
        descricaoProduto:
          numeroRequisicao == null
            ? descricoesProduto.get(chaveCupom) ?? null
            : null,
        codigoTerminal: pagamento.codigoTerminal,
        formaPagamento: pagamento.formaPagamento,
        formaNormalizada: normalizarFormaErp(pagamento.formaPagamento),
        valorLiquido: Number(pagamento.valorLiquido),
        valorPago: Number(pagamento.valorPago),
        valorTroco: Number(pagamento.valorTroco),
        codigoCliente: pagamento.codigoCliente ?? null,
        clienteNome:
          pagamento.codigoCliente != null
            ? nomesClientes.get(pagamento.codigoCliente) ?? null
            : null,
        nomeOperadorCaixa: pagamento.nomeOperadorCaixa ?? null,
      };
    });
  }

  private buildChaveCupomOperacao(
    numeroCupom: number,
    codigoTerminal: number,
    idOperacao: number,
  ): string {
    return `${numeroCupom}-${codigoTerminal}-${idOperacao}`;
  }

  private async resolverDescricoesProdutoPorCupom(
    unidade: Unidade,
    data: string,
    pagamentos: CaixaPagamentoErp[],
  ): Promise<Map<string, string>> {
    const cuponsUnicos = [
      ...new Set(pagamentos.map((pagamento) => pagamento.numeroCupom)),
    ];
    if (cuponsUnicos.length === 0) {
      return new Map();
    }

    const itens = await this.itemRepo.find({
      where: {
        unidade,
        dataOperacao: data,
        tipoItem: CaixaTipoItem.PRODUTO,
        numeroCupom: In(cuponsUnicos),
      },
      select: [
        'numeroCupom',
        'codigoTerminal',
        'idOperacao',
        'sequenciaItem',
        'descricaoItem',
        'codigoRequisicaoProduto',
      ],
      order: {
        numeroCupom: 'ASC',
        sequenciaItem: 'ASC',
      },
    });

    const mapa = new Map<string, string[]>();

    for (const item of itens) {
      const chave = this.buildChaveCupomOperacao(
        item.numeroCupom,
        item.codigoTerminal,
        item.idOperacao,
      );
      const descricao =
        item.descricaoItem?.trim() ||
        (item.codigoRequisicaoProduto != null
          ? `Produto ${item.codigoRequisicaoProduto}`
          : null);
      if (!descricao) {
        continue;
      }

      const existentes = mapa.get(chave) ?? [];
      if (!existentes.includes(descricao)) {
        existentes.push(descricao);
        mapa.set(chave, existentes);
      }
    }

    return new Map(
      [...mapa.entries()].map(([chave, descricoes]) => [
        chave,
        descricoes.join(', '),
      ]),
    );
  }

  private async resolverNumerosRequisicaoPorCupom(
    unidade: Unidade,
    data: string,
    cupons: number[],
  ): Promise<Map<number, number>> {
    const cuponsUnicos = [...new Set(cupons)];
    if (cuponsUnicos.length === 0) {
      return new Map();
    }

    const requisicoes = await this.requisicaoRepo.find({
      where: {
        unidade,
        dataPagamento: data,
        numeroCupom: In(cuponsUnicos),
      },
      select: ['numeroCupom', 'numeroRequisicao'],
      order: { numeroRequisicao: 'ASC' },
    });

    const mapa = new Map<number, number>();
    for (const requisicao of requisicoes) {
      if (!mapa.has(requisicao.numeroCupom)) {
        mapa.set(requisicao.numeroCupom, requisicao.numeroRequisicao);
      }
    }

    return mapa;
  }

  private async resolverNomesClientesPorCodigo(
    unidade: Unidade,
    codigosCliente: number[],
  ): Promise<Map<number, string>> {
    const codigosUnicos = [...new Set(codigosCliente)];
    if (codigosUnicos.length === 0) {
      return new Map();
    }

    const clientes = await this.clienteRepo.find({
      where: {
        unidade,
        cdcliente: In(codigosUnicos),
      },
      select: ['cdcliente', 'nome'],
    });

    return new Map(
      clientes
        .filter((cliente) => cliente.cdcliente != null)
        .map((cliente) => [cliente.cdcliente as number, cliente.nome]),
    );
  }

  private async obterTotaisPorForma(
    unidade: Unidade,
    dataInicio: string,
    dataFim: string,
  ): Promise<Record<string, CaixaFormaTotalDto>> {
    const rows = await this.pagamentoRepo
      .createQueryBuilder('p')
      .select('p.formaPagamento', 'forma')
      .addSelect('COUNT(*)', 'qtd')
      .addSelect('SUM(p.valorLiquido)', 'liquido')
      .where('p.unidade = :unidade', { unidade })
      .andWhere('p.dataOperacao >= :dataInicio', { dataInicio })
      .andWhere('p.dataOperacao <= :dataFim', { dataFim })
      .groupBy('p.formaPagamento')
      .getRawMany<{ forma: string; qtd: string; liquido: string }>();

    const result: Record<string, CaixaFormaTotalDto> = {};
    for (const row of rows) {
      result[row.forma] = {
        qtd: Number(row.qtd),
        liquido: Math.round(Number(row.liquido) * 100) / 100,
      };
    }
    return result;
  }

  async obterTotaisTerceiroDetalhe(
    unidade: Unidade,
    dataInicio: string,
    dataFim: string,
  ): Promise<CaixaTerceiroOrigemTotalDto[]> {
    const rows = await this.baixaRepo
      .createQueryBuilder('b')
      .innerJoin('b.venda', 'v')
      .select('b.tipoDaBaixa', 'forma')
      .addSelect('v.origem', 'origem')
      .addSelect('COUNT(*)', 'qtd')
      .addSelect('SUM(b.valorBaixa)', 'liquido')
      .where('v.unidade = :unidade', { unidade })
      .andWhere('b.dataBaixa >= :dataInicio', { dataInicio })
      .andWhere('b.dataBaixa <= :dataFim', { dataFim })
      .groupBy('b.tipoDaBaixa')
      .addGroupBy('v.origem')
      .getRawMany<{
        forma: string;
        origem: string;
        qtd: string;
        liquido: string;
      }>();

    return rows.map((row) => ({
      forma: normalizarFormaTerceiro(row.forma),
      origem: row.origem,
      qtd: Number(row.qtd),
      liquido: Math.round(Number(row.liquido) * 100) / 100,
    }));
  }

  agregarTotaisTerceiroPorForma(
    detalhe: CaixaTerceiroOrigemTotalDto[],
  ): Record<string, CaixaFormaTotalDto> {
    const result: Record<string, CaixaFormaTotalDto> = {};
    for (const item of detalhe) {
      const atual = result[item.forma] ?? { qtd: 0, liquido: 0 };
      result[item.forma] = {
        qtd: atual.qtd + item.qtd,
        liquido: Math.round((atual.liquido + item.liquido) * 100) / 100,
      };
    }
    return result;
  }

  normalizarTotaisErp(
    totais: Record<string, CaixaFormaTotalDto>,
  ): Record<string, CaixaFormaTotalDto> {
    const acumulado = new Map<string, CaixaFormaTotalDto>();
    for (const [forma, item] of Object.entries(totais)) {
      const normalizada = normalizarFormaErp(forma);
      const atual = acumulado.get(normalizada) ?? { qtd: 0, liquido: 0 };
      acumulado.set(normalizada, {
        qtd: atual.qtd + item.qtd,
        liquido: Math.round((atual.liquido + item.liquido) * 100) / 100,
      });
    }
    return Object.fromEntries(acumulado.entries());
  }


  private montarTotaisConsolidados(
    erp: Record<string, CaixaFormaTotalDto>,
    terceiro: Record<string, CaixaFormaTotalDto>,
  ): Record<string, CaixaFormaTotalDto> {
    const acumulado = new Map<string, CaixaFormaTotalDto>();

    const add = (formaNormalizada: string, item: CaixaFormaTotalDto): void => {
      const atual = acumulado.get(formaNormalizada) ?? { qtd: 0, liquido: 0 };
      acumulado.set(formaNormalizada, {
        qtd: atual.qtd + item.qtd,
        liquido: Math.round((atual.liquido + item.liquido) * 100) / 100,
      });
    };

    for (const [forma, item] of Object.entries(erp)) {
      add(formaBlocoFechamento(forma), item);
    }
    for (const [forma, item] of Object.entries(terceiro)) {
      add(forma, item);
    }

    return Object.fromEntries(acumulado.entries());
  }

  private somarLiquido(totais: Record<string, CaixaFormaTotalDto>): number {
    const total = Object.values(totais).reduce(
      (acc, item) => acc + item.liquido,
      0,
    );
    return Math.round(total * 100) / 100;
  }

  private buildChavePagamento(
    unidade: Unidade,
    row: AgenteCaixaPagamentoRow,
  ): string {
    return `${unidade}-${row.cdtml}-${row.data}-${row.operid}-${row.cupom}-${row.fmpag}`;
  }

  private buildChaveItem(unidade: Unidade, row: AgenteCaixaItemRow): string {
    return `${unidade}-${row.cdtml}-${row.data}-${row.operid}-${row.cupom}-${row.item_cupom}`;
  }

  private buildChaveRequisicao(
    unidade: Unidade,
    row: AgenteCaixaRequisicaoRow,
  ): string {
    return `${unidade}-${row.requisicao}-${row.cupom}-${row.data_pagamento}`;
  }

  private deduplicarPorChaveErp<T extends { chaveErp: string }>(
    entities: T[],
    contexto: string,
  ): T[] {
    if (entities.length <= 1) {
      return entities;
    }

    const map = new Map<string, T>();
    for (const entity of entities) {
      map.set(entity.chaveErp, entity);
    }

    const unicas = [...map.values()];
    const removidas = entities.length - unicas.length;
    if (removidas > 0) {
      this.logger.warn(
        `Removidas ${removidas} linha(s) duplicada(s) por chave_erp em ${contexto} antes do upsert`,
      );
    }

    return unicas;
  }

  private formatDateDisplay(date: string): string {
    if (!date || date.length !== 10) {
      return date;
    }
    const [year, month, day] = date.split('-');
    return `${day}/${month}/${year}`;
  }
}
