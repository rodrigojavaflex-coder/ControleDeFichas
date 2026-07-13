import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unidade } from '../../common/enums/unidade.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { FechamentoCaixaService } from './fechamento-caixa.service';
import { CaixaSaldoInicialUnidade } from './entities/caixa-saldo-inicial-unidade.entity';
import { CaixaFechamento } from './entities/caixa-fechamento.entity';
import { CaixaFechamentoLinha } from './entities/caixa-fechamento-linha.entity';
import {
  CaixaFechamentoLinhaTipo,
  CaixaFechamentoStatus,
} from './enums/caixa-fechamento-status.enum';
import { CaixaFechamentoStatusExibicao } from './enums/caixa-fechamento-status-exibicao.enum';
import { FechamentoConsolidadoResponseDto } from './dto/fechamento-consolidado-response.dto';
import { FechamentoConsolidadoQueryDto } from './dto/fechamento-consolidado-query.dto';
import { SalvarFechamentoRascunhoDto } from './dto/salvar-fechamento-rascunho.dto';
import {
  AtualizarSaldoInicialUnidadeDto,
  CaixaSaldoInicialUnidadeDto,
} from './dto/caixa-saldo-inicial.dto';
import { CaixaTerceiroOrigemTotalDto } from './dto/caixa-terceiro-origem-total.dto';
import { CaixaFormaTotalDto } from './dto/importar-caixa-erp-response.dto';
import { normalizarDataIso } from '../../common/utils/data-date.util';
import {
  formaBlocoFechamento,
  FORMAS_FECHAMENTO_CAIXA,
  ordenarFormasFechamento,
  ordenarLinhasErpNoBloco,
} from './utils/caixa-forma.util';

@Injectable()
export class CaixaFechamentoConsolidadoService {
  constructor(
    private readonly fechamentoCaixaService: FechamentoCaixaService,
    @InjectRepository(CaixaSaldoInicialUnidade)
    private readonly saldoRepo: Repository<CaixaSaldoInicialUnidade>,
    @InjectRepository(CaixaFechamento)
    private readonly fechamentoRepo: Repository<CaixaFechamento>,
    @InjectRepository(CaixaFechamentoLinha)
    private readonly linhaRepo: Repository<CaixaFechamentoLinha>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  async listarSaldosIniciais(): Promise<CaixaSaldoInicialUnidadeDto[]> {
    const rows = await this.saldoRepo.find({ order: { unidade: 'ASC' } });
    const map = new Map(rows.map((r) => [r.unidade, r]));
    return Object.values(Unidade).map((unidade) => ({
      unidade,
      saldoInicial: map.get(unidade)?.saldoInicial ?? 0,
      dataSaldo: map.get(unidade)?.dataSaldo ?? null,
    }));
  }

  async atualizarSaldoInicial(
    dto: AtualizarSaldoInicialUnidadeDto,
  ): Promise<CaixaSaldoInicialUnidadeDto> {
    let row = await this.saldoRepo.findOne({ where: { unidade: dto.unidade } });
    if (!row) {
      row = this.saldoRepo.create({
        unidade: dto.unidade,
        saldoInicial: dto.saldoInicial,
        dataSaldo: dto.dataSaldo,
      });
    } else {
      row.saldoInicial = dto.saldoInicial;
      row.dataSaldo = dto.dataSaldo;
    }
    const saved = await this.saldoRepo.save(row);
    return {
      unidade: saved.unidade,
      saldoInicial: saved.saldoInicial,
      dataSaldo: saved.dataSaldo,
    };
  }

  async obterConsolidado(
    query: FechamentoConsolidadoQueryDto,
  ): Promise<FechamentoConsolidadoResponseDto> {
    const fechamento = await this.fechamentoRepo.findOne({
      where: {
        unidade: query.unidade,
        dataOperacao: query.data,
      },
    });

    const totaisPorForma = await this.fechamentoCaixaService.obterTotaisPorFormaPublic(
      query.unidade,
      query.data,
      query.data,
    );
    const totaisErp = this.fechamentoCaixaService.normalizarTotaisErp(
      totaisPorForma,
    );
    const totaisTerceiroDetalhe =
      await this.fechamentoCaixaService.obterTotaisTerceiroDetalhe(
        query.unidade,
        query.data,
        query.data,
      );

    const saldoInicial =
      fechamento?.status === CaixaFechamentoStatus.CONFIRMADO
        ? Number(fechamento.saldoInicial)
        : await this.resolverSaldoInicial(query.unidade, query.data);

    const totalDespesas = fechamento ? Number(fechamento.totalDespesas) : 0;
    const totalRetirada = fechamento ? Number(fechamento.totalRetirada) : 0;

    const formas = this.montarBlocosFormas(totaisErp, totaisTerceiroDetalhe);

    const totalDinheiroForma =
      formas.find((f) => f.forma === 'DINHEIRO')?.totalForma ?? 0;
    const saldoFinalDinheiro =
      fechamento?.status === CaixaFechamentoStatus.CONFIRMADO
        ? fechamento.saldoFinal
        : Math.round(
            (saldoInicial +
              totalDinheiroForma -
              totalDespesas -
              totalRetirada) *
              100,
          ) / 100;

    const ultimaDataConfirmada = await this.obterUltimaDataConfirmada(
      query.unidade,
    );
    const dataConsulta = normalizarDataIso(query.data) ?? query.data;
    const statusExibicao = this.resolverStatusExibicao(
      fechamento,
      dataConsulta,
      ultimaDataConfirmada,
    );
    const podeEditarData = this.calcularPodeEditar(
      dataConsulta,
      ultimaDataConfirmada,
    );
    const podeEditar =
      statusExibicao === CaixaFechamentoStatusExibicao.RASCUNHO &&
      podeEditarData;
    const podeReabrir =
      statusExibicao === CaixaFechamentoStatusExibicao.FECHADO &&
      ultimaDataConfirmada != null &&
      dataConsulta === ultimaDataConfirmada;
    const podeEmitirRelatorio =
      statusExibicao === CaixaFechamentoStatusExibicao.FECHADO ||
      statusExibicao === CaixaFechamentoStatusExibicao.RASCUNHO ||
      statusExibicao === CaixaFechamentoStatusExibicao.BLOQUEADO;

    const confirmadoPorNome = await this.resolverConfirmadoPorNome(
      fechamento?.confirmadoPor ?? null,
    );

    return {
      unidade: query.unidade,
      data: query.data,
      fechamentoId: fechamento?.id,
      status: fechamento?.status,
      statusExibicao,
      saldoInicial,
      totalDespesas,
      totalRetirada,
      saldoFinalDinheiro,
      ultimaDataConfirmada,
      podeEditar,
      podeReabrir,
      podeEmitirRelatorio,
      podeConfirmar:
        statusExibicao === CaixaFechamentoStatusExibicao.RASCUNHO &&
        podeEditarData,
      formas,
      confirmadoPorNome,
    };
  }

  async assertPodeEmitirRelatorio(
    unidade: Unidade,
    data: string,
  ): Promise<void> {
    await this.obterConsolidado({ unidade, data });
  }

  private resolverStatusExibicao(
    fechamento: CaixaFechamento | null,
    dataConsulta: string,
    ultimaDataConfirmada: string | null,
  ): CaixaFechamentoStatusExibicao {
    if (fechamento?.status === CaixaFechamentoStatus.CONFIRMADO) {
      return CaixaFechamentoStatusExibicao.FECHADO;
    }

    if (ultimaDataConfirmada && dataConsulta < ultimaDataConfirmada) {
      return CaixaFechamentoStatusExibicao.BLOQUEADO;
    }

    return CaixaFechamentoStatusExibicao.RASCUNHO;
  }

  private async resolverConfirmadoPorNome(
    confirmadoPorId: string | null,
  ): Promise<string | null> {
    if (!confirmadoPorId) {
      return null;
    }

    const usuario = await this.usuarioRepo.findOne({
      where: { id: confirmadoPorId },
      select: ['id', 'nome', 'email'],
    });

    if (!usuario) {
      return null;
    }

    return usuario.nome?.trim() || usuario.email || null;
  }

  async salvarRascunho(
    dto: SalvarFechamentoRascunhoDto,
  ): Promise<FechamentoConsolidadoResponseDto> {
    await this.assertPodeEditarFechamento(dto.unidade, dto.data);

    const saldoInicial = await this.resolverSaldoInicial(dto.unidade, dto.data);
    let fechamento = await this.fechamentoRepo.findOne({
      where: { unidade: dto.unidade, dataOperacao: dto.data },
    });

    if (fechamento?.status === CaixaFechamentoStatus.CONFIRMADO) {
      throw new ConflictException(
        'Fechamento já confirmado. Reabra o último registro para alterar.',
      );
    }

    if (!fechamento) {
      fechamento = this.fechamentoRepo.create({
        unidade: dto.unidade,
        dataOperacao: dto.data,
        status: CaixaFechamentoStatus.RASCUNHO,
        saldoInicial,
        totalDespesas: dto.totalDespesas,
        totalRetirada: dto.totalRetirada,
        saldoFinal: null,
      });
    } else {
      fechamento.totalDespesas = dto.totalDespesas;
      fechamento.totalRetirada = dto.totalRetirada;
      fechamento.saldoInicial = saldoInicial;
    }

    const saved = await this.fechamentoRepo.save(fechamento);
    await this.persistirLinhasCalculadas(saved);

    return this.obterConsolidado({
      unidade: dto.unidade,
      data: dto.data,
    });
  }

  async confirmarFechamento(
    usuario: Usuario,
    unidade: Unidade,
    data: string,
  ): Promise<FechamentoConsolidadoResponseDto> {
    await this.assertPodeEditarFechamento(unidade, data);

    const consolidado = await this.obterConsolidado({ unidade, data });
    let fechamento = await this.fechamentoRepo.findOne({
      where: { unidade, dataOperacao: data },
    });

    if (!fechamento) {
      fechamento = this.fechamentoRepo.create({
        unidade,
        dataOperacao: data,
        status: CaixaFechamentoStatus.RASCUNHO,
        saldoInicial: consolidado.saldoInicial,
        totalDespesas: consolidado.totalDespesas,
        totalRetirada: consolidado.totalRetirada,
      });
    }

    fechamento.status = CaixaFechamentoStatus.CONFIRMADO;
    fechamento.saldoFinal = consolidado.saldoFinalDinheiro;
    fechamento.confirmadoEm = new Date();
    fechamento.confirmadoPor = usuario.id;
    fechamento.saldoInicial = consolidado.saldoInicial;
    fechamento.totalDespesas = consolidado.totalDespesas;
    fechamento.totalRetirada = consolidado.totalRetirada;

    const saved = await this.fechamentoRepo.save(fechamento);
    await this.persistirLinhasCalculadas(saved);

    return this.obterConsolidado({ unidade, data });
  }

  async reabrirFechamento(
    unidade: Unidade,
    data: string,
  ): Promise<FechamentoConsolidadoResponseDto> {
    const dataNormalizada = normalizarDataIso(data) ?? data;
    const ultima = await this.obterUltimaDataConfirmada(unidade);
    if (!ultima) {
      throw new ConflictException(
        'Não há caixa fechado pela unidade para reabrir.',
      );
    }
    if (dataNormalizada < ultima) {
      throw new ConflictException(
        'Caixas com data anterior ao último fechamento da unidade não podem ser reabertos.',
      );
    }
    if (dataNormalizada !== ultima) {
      throw new ConflictException(
        'Somente o último caixa fechado da unidade pode ser reaberto.',
      );
    }

    const fechamento = await this.fechamentoRepo.findOne({
      where: { unidade, dataOperacao: data },
    });
    if (!fechamento) {
      throw new NotFoundException('Fechamento de caixa não encontrado.');
    }
    if (fechamento.status !== CaixaFechamentoStatus.CONFIRMADO) {
      throw new BadRequestException(
        'Somente fechamentos confirmados podem ser reabertos.',
      );
    }

    fechamento.status = CaixaFechamentoStatus.RASCUNHO;
    fechamento.saldoFinal = null;
    fechamento.confirmadoEm = null;
    fechamento.confirmadoPor = null;
    await this.fechamentoRepo.save(fechamento);

    return this.obterConsolidado({ unidade, data });
  }

  private async persistirLinhasCalculadas(
    fechamento: CaixaFechamento,
  ): Promise<void> {
    await this.linhaRepo.delete({ fechamentoId: fechamento.id });

    const totaisPorForma =
      await this.fechamentoCaixaService.obterTotaisPorFormaPublic(
        fechamento.unidade,
        fechamento.dataOperacao,
        fechamento.dataOperacao,
      );
    const totaisErp = this.fechamentoCaixaService.normalizarTotaisErp(
      totaisPorForma,
    );
    const detalhe =
      await this.fechamentoCaixaService.obterTotaisTerceiroDetalhe(
        fechamento.unidade,
        fechamento.dataOperacao,
        fechamento.dataOperacao,
      );

    const linhas: Partial<CaixaFechamentoLinha>[] = [];

    for (const [forma, item] of Object.entries(totaisErp)) {
      linhas.push({
        fechamentoId: fechamento.id,
        forma,
        tipoLinha: CaixaFechamentoLinhaTipo.ERP,
        origem: null,
        qtd: item.qtd,
        valor: item.liquido,
      });
    }

    for (const item of detalhe) {
      linhas.push({
        fechamentoId: fechamento.id,
        forma: item.forma,
        tipoLinha: CaixaFechamentoLinhaTipo.TERCEIRO,
        origem: item.origem as CaixaFechamentoLinha['origem'],
        qtd: item.qtd,
        valor: item.liquido,
      });
    }

    if (linhas.length > 0) {
      await this.linhaRepo.save(linhas.map((l) => this.linhaRepo.create(l)));
    }
  }

  private montarBlocosFormas(
    totaisErp: Record<string, CaixaFormaTotalDto>,
    terceiroDetalhe: CaixaTerceiroOrigemTotalDto[],
  ) {
    const terceiroValido = terceiroDetalhe.filter((item) =>
      FORMAS_FECHAMENTO_CAIXA.includes(
        item.forma as (typeof FORMAS_FECHAMENTO_CAIXA)[number],
      ),
    );

    return ordenarFormasFechamento([...FORMAS_FECHAMENTO_CAIXA]).map(
      (blocoForma) => {
        const erpLinhas = Object.entries(totaisErp)
          .filter(([forma]) => formaBlocoFechamento(forma) === blocoForma)
          .map(([forma, item]) => ({
            forma,
            qtd: item.qtd,
            liquido: item.liquido,
          }))
          .sort((a, b) => ordenarLinhasErpNoBloco(a.forma, b.forma));

        const terceiroPorOrigem = terceiroValido.filter(
          (item) => item.forma === blocoForma,
        );
        const totalErp = erpLinhas.reduce((acc, linha) => acc + linha.liquido, 0);
        const totalTerceiro = terceiroPorOrigem.reduce(
          (acc, item) => acc + item.liquido,
          0,
        );

        return {
          forma: blocoForma,
          erp:
            erpLinhas.length === 1
              ? { qtd: erpLinhas[0].qtd, liquido: erpLinhas[0].liquido }
              : null,
          erpLinhas,
          terceiroPorOrigem,
          totalForma: Math.round((totalErp + totalTerceiro) * 100) / 100,
        };
      },
    );
  }

  private async resolverSaldoInicial(
    unidade: Unidade,
    data: string,
  ): Promise<number> {
    const anterior = await this.fechamentoRepo
      .createQueryBuilder('f')
      .where('f.unidade = :unidade', { unidade })
      .andWhere('f.dataOperacao < :data', { data })
      .andWhere('f.status = :status', {
        status: CaixaFechamentoStatus.CONFIRMADO,
      })
      .orderBy('f.dataOperacao', 'DESC')
      .getOne();

    if (anterior?.saldoFinal != null) {
      return Number(anterior.saldoFinal);
    }

    const config = await this.saldoRepo.findOne({ where: { unidade } });
    if (!config) {
      return 0;
    }

    const dataSaldo = normalizarDataIso(config.dataSaldo);
    if (dataSaldo && data < dataSaldo) {
      return 0;
    }

    return config.saldoInicial ?? 0;
  }

  private async obterUltimaDataConfirmada(
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

  private calcularPodeEditar(
    data: string,
    ultimaDataConfirmada: string | null,
  ): boolean {
    if (!ultimaDataConfirmada) {
      return true;
    }
    return data >= ultimaDataConfirmada;
  }

  private async assertPodeEditarFechamento(
    unidade: Unidade,
    data: string,
  ): Promise<void> {
    await this.fechamentoCaixaService.assertPodeAlterarDataCaixa(unidade, data);
  }
}
