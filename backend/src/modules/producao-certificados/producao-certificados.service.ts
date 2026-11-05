import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Unidade } from '../../common/enums/unidade.enum';
import { padronizarNomeDeSistemaLegado } from '../../common/utils/encoding-legado.util';
import { fetchAgenteComRetry } from '../../common/utils/fetch-agente-com-retry.util';
import { ProducaoCertificadoAnalise } from './entities/producao-certificado-analise.entity';

export interface AgenteCertificadoAnalise {
  numero: number;
  filial: number;
  codigoProduto: number | null;
  tipo: string | null;
  dataCertificado: string;
  dataFabricacao: string | null;
  dataValidade: string | null;
  funcionarioCodigo: number | null;
  produtoNome: string | null;
}

export interface ProducaoCertificadosSyncStats {
  lidos: number;
  criados: number;
  atualizados: number;
  removidos: number;
  ignorados: number;
}

@Injectable()
export class ProducaoCertificadosService {
  private readonly logger = new Logger(ProducaoCertificadosService.name);

  constructor(
    @InjectRepository(ProducaoCertificadoAnalise)
    private readonly repo: Repository<ProducaoCertificadoAnalise>,
  ) {}

  async listarNoPeriodo(
    unidades: Unidade[],
    dataInicio: string,
    dataFim: string,
  ): Promise<ProducaoCertificadoAnalise[]> {
    if (unidades.length === 0) return [];
    return this.repo
      .createQueryBuilder('c')
      .where('c.unidade IN (:...unidades)', { unidades })
      .andWhere('c.dataCertificado >= :dataInicio', { dataInicio })
      .andWhere('c.dataCertificado <= :dataFim', { dataFim })
      .getMany();
  }

  async buscarDoAgente(
    url: string,
    token: string,
    unit: number,
    start: string,
    end: string,
    agente: string,
  ): Promise<AgenteCertificadoAnalise[]> {
    const urlCompleta = `${url}/api/v1/producao/certificados-analise`;
    this.logger.log(
      `[${agente}] Consultando certificados FC21000: ${urlCompleta} (${start}..${end}, cdfil=${unit})`,
    );
    const response = await fetchAgenteComRetry(
      urlCompleta,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ unit, start, end }),
      },
      {
        timeoutMs: 120000,
        logger: this.logger,
        rotulo: `[${agente}] certificados-analise`,
      },
    );
    const data = (await response.json()) as {
      certificados?: AgenteCertificadoAnalise[];
    };
    const lista = data.certificados ?? [];
    this.logger.log(
      `[${agente}] Agente retornou ${lista.length} certificado(s) de análise`,
    );
    return lista;
  }

  /**
   * Substitui o conjunto da filial na janela: apaga o que o ERP não devolveu e faz upsert do retorno.
   * Falha antes da transação não apaga nada.
   */
  async reconciliarPeriodo(
    unidade: Unidade,
    filial: number,
    dataInicio: string,
    dataFim: string,
    linhas: AgenteCertificadoAnalise[],
  ): Promise<ProducaoCertificadosSyncStats> {
    const stats: ProducaoCertificadosSyncStats = {
      lidos: linhas.length,
      criados: 0,
      atualizados: 0,
      removidos: 0,
      ignorados: 0,
    };

    const porNumero = new Map<number, AgenteCertificadoAnalise>();
    for (const linha of linhas) {
      const numero = numeroPositivo(linha.numero);
      const data = dataIso(linha.dataCertificado);
      if (
        numero == null ||
        !data ||
        Number(linha.filial) !== filial ||
        data < dataInicio ||
        data > dataFim
      ) {
        stats.ignorados += 1;
        continue;
      }
      porNumero.set(numero, { ...linha, numero, dataCertificado: data });
    }

    const numeros = [...porNumero.keys()];

    await this.repo.manager.transaction(async (manager) => {
      const tx = manager.getRepository(ProducaoCertificadoAnalise);
      const qb = tx
        .createQueryBuilder()
        .delete()
        .where('unidade = :unidade', { unidade })
        .andWhere('filial = :filial', { filial })
        .andWhere('dataCertificado >= :dataInicio', { dataInicio })
        .andWhere('dataCertificado <= :dataFim', { dataFim });
      if (numeros.length > 0) {
        qb.andWhere('numeroCertificado NOT IN (:...numeros)', { numeros });
      }
      const removed = await qb.execute();
      stats.removidos = removed.affected ?? 0;

      if (numeros.length === 0) return;

      const existentes = await tx.find({
        where: {
          unidade,
          filial,
          numeroCertificado: In(numeros),
        },
      });
      const porExistente = new Map(
        existentes.map((e) => [e.numeroCertificado, e]),
      );

      for (const item of porNumero.values()) {
        const atual = porExistente.get(item.numero);
        const campos = this.mapearCampos(item);
        if (!atual) {
          await tx.save(
            tx.create({
              unidade,
              filial,
              numeroCertificado: item.numero,
              ...campos,
            }),
          );
          stats.criados += 1;
          continue;
        }
        Object.assign(atual, campos);
        await tx.save(atual);
        stats.atualizados += 1;
      }
    });

    this.logger.log(
      `Certificados ${unidade}/cdfil ${filial} ${dataInicio}..${dataFim}: lidos=${stats.lidos} criados=${stats.criados} atualizados=${stats.atualizados} removidos=${stats.removidos} ignorados=${stats.ignorados}`,
    );
    return stats;
  }

  private mapearCampos(
    item: AgenteCertificadoAnalise,
  ): Pick<
    ProducaoCertificadoAnalise,
    | 'dataCertificado'
    | 'dataFabricacao'
    | 'dataValidade'
    | 'codigoProduto'
    | 'tipoCertificado'
    | 'funcionarioCodigo'
    | 'produtoNome'
  > {
    const nome = item.produtoNome?.trim()
      ? padronizarNomeDeSistemaLegado(item.produtoNome).slice(0, 200)
      : '';
    return {
      dataCertificado: dataIso(item.dataCertificado) ?? item.dataCertificado,
      dataFabricacao: dataIso(item.dataFabricacao),
      dataValidade: dataIso(item.dataValidade),
      codigoProduto: numeroPositivo(item.codigoProduto),
      tipoCertificado: item.tipo?.trim() ? item.tipo.trim().slice(0, 20) : null,
      funcionarioCodigo: numeroPositivo(item.funcionarioCodigo),
      produtoNome: nome || null,
    };
  }
}

function numeroPositivo(valor: unknown): number | null {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function dataIso(valor: unknown): string | null {
  if (valor == null || valor === '') return null;
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${valor.getFullYear()}-${pad(valor.getMonth() + 1)}-${pad(valor.getDate())}`;
  }
  const texto = String(valor).trim();
  const match = texto.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}
