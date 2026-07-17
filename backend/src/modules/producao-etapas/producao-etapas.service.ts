import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProducaoEtapaResumo } from './entities/producao-etapa-resumo.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import {
  normalizarTextoLegado,
  padronizarNomeDeSistemaLegado,
  padronizarNomeLegadoNullable,
} from '../../common/utils/encoding-legado.util';

export interface AgenteProducaoEtapa {
  filial: number;
  requisicao: number;
  formula: string;
  cod_etapa: string;
  etapa: string;
  posicao_etapa: number;
  cod_func_entrada?: number | null;
  func_entrada?: string | null;
  cod_func_saida?: number | null;
  func_saida?: string | null;
  data_entrada?: string | null;
  hora_entrada?: string | null;
  data_saida?: string | null;
  hora_saida?: string | null;
  tempo_etapa?: number | null;
  forma_farmaceutica?: string | null;
  quantidade?: number | null;
  unidade_medida?: string | null;
  laboratorio?: string | null;
  tipo_formula?: string | null;
  qtd_principios_ativos: number;
  principios_ativos?: string | null;
  embalagem?: string | null;
  paciente?: string | null;
  codigo_cliente?: number | null;
  cliente?: string | null;
  crf?: string | null;
  uf_crf?: string | null;
  nome_prescritor?: string | null;
  data_retirada?: string | null;
  hora_retirada?: string | null;
}

export interface ProducaoEtapasSyncResult {
  processados: number;
  criados: number;
  atualizados: number;
}

export type ProducaoEtapasProgressCallback = (
  stats: ProducaoEtapasSyncResult & { total: number },
) => void;

@Injectable()
export class ProducaoEtapasService {
  private readonly logger = new Logger(ProducaoEtapasService.name);

  private readonly agenteUnidadeMap: Record<string, Unidade> = {
    inhumas: Unidade.INHUMAS,
    uberaba: Unidade.UBERABA,
    neropolis: Unidade.NERÓPOLIS,
  };

  private readonly agenteCdfilMap: Record<string, number> = {
    inhumas: 2,
    uberaba: 2,
    neropolis: 4,
  };

  constructor(
    @InjectRepository(ProducaoEtapaResumo)
    private readonly etapaRepository: Repository<ProducaoEtapaResumo>,
  ) {}

  getUnidadePorAgente(agente: string): Unidade {
    const unidade = this.agenteUnidadeMap[agente];
    if (!unidade) {
      throw new Error(`Unidade não mapeada para o agente: ${agente}`);
    }
    return unidade;
  }

  getCdfilPorAgente(agente: string): number {
    const unit = this.agenteCdfilMap[agente];
    if (!unit) {
      throw new Error(`CDFIL não mapeado para o agente: ${agente}`);
    }
    return unit;
  }

  async buscarPeriodoDoAgente(
    url: string,
    token: string,
    unit: number,
    start: string,
    end: string,
    agente: string,
  ): Promise<AgenteProducaoEtapa[]> {
    return this.postAgente(url, token, agente, {
      unit,
      start,
      end,
    });
  }

  async buscarIncrementalDoAgente(
    url: string,
    token: string,
    unit: number,
    dataMinimaMovimento: string,
    agente: string,
  ): Promise<AgenteProducaoEtapa[]> {
    return this.postAgente(url, token, agente, {
      unit,
      dataMinimaMovimento,
    });
  }

  private async postAgente(
    url: string,
    token: string,
    agente: string,
    body: Record<string, unknown>,
  ): Promise<AgenteProducaoEtapa[]> {
    const urlCompleta = `${url}/api/v1/producao/etapas-resumo`;

    this.logger.log(`[${agente}] Chamando agente produção: ${urlCompleta}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    try {
      const response = await fetch(urlCompleta, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Erro ao buscar etapas do agente: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();
      return data.etapas || [];
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout ao buscar etapas do agente');
      }
      throw error;
    }
  }

  async processarLote(
    registros: AgenteProducaoEtapa[],
    unidade: Unidade,
    onProgress?: ProducaoEtapasProgressCallback,
  ): Promise<ProducaoEtapasSyncResult> {
    const resultado: ProducaoEtapasSyncResult = {
      processados: 0,
      criados: 0,
      atualizados: 0,
    };
    const total = registros.length;

    for (const registro of registros) {
      resultado.processados++;
      const foiCriado = await this.upsertRegistro(registro, unidade);
      if (foiCriado) {
        resultado.criados++;
      } else {
        resultado.atualizados++;
      }

      if (
        onProgress &&
        (resultado.processados === 1 ||
          resultado.processados === total ||
          resultado.processados % 50 === 0)
      ) {
        onProgress({ ...resultado, total });
      }
    }

    if (onProgress && total > 0) {
      onProgress({ ...resultado, total });
    }

    return resultado;
  }

  private async upsertRegistro(
    registro: AgenteProducaoEtapa,
    unidade: Unidade,
  ): Promise<boolean> {
    const formula = String(registro.formula ?? '').trim();
    const codEtapa = String(registro.cod_etapa ?? '').trim();

    let etapa = await this.etapaRepository.findOne({
      where: {
        unidade,
        filial: Number(registro.filial ?? 0),
        requisicao: Number(registro.requisicao ?? 0),
        formula,
        codEtapa,
      },
    });

    const foiCriado = !etapa;
    const payload: Partial<ProducaoEtapaResumo> = {
      unidade,
      filial: Number(registro.filial ?? 0),
      requisicao: Number(registro.requisicao ?? 0),
      formula,
      codEtapa,
      etapa: padronizarNomeDeSistemaLegado(registro.etapa || ''),
      posicaoEtapa: Number(registro.posicao_etapa ?? 0),
      codFuncEntrada: registro.cod_func_entrada ?? null,
      funcEntrada: padronizarNomeLegadoNullable(registro.func_entrada),
      codFuncSaida: registro.cod_func_saida ?? null,
      funcSaida: padronizarNomeLegadoNullable(registro.func_saida),
      dataEntrada: registro.data_entrada || null,
      horaEntrada: registro.hora_entrada || null,
      dataSaida: registro.data_saida || null,
      horaSaida: registro.hora_saida || null,
      tempoEtapa:
        registro.tempo_etapa != null ? Number(registro.tempo_etapa) : null,
      formaFarmaceutica: normalizarTextoLegado(registro.forma_farmaceutica),
      quantidade:
        registro.quantidade != null ? Number(registro.quantidade) : null,
      unidadeMedida: normalizarTextoLegado(registro.unidade_medida),
      laboratorio: normalizarTextoLegado(registro.laboratorio),
      tipoFormula: normalizarTextoLegado(registro.tipo_formula),
      qtdPrincipiosAtivos: Number(registro.qtd_principios_ativos ?? 0),
      principiosAtivos: normalizarTextoLegado(registro.principios_ativos),
      embalagem: normalizarTextoLegado(registro.embalagem),
      paciente: padronizarNomeLegadoNullable(registro.paciente),
      codigoCliente:
        registro.codigo_cliente != null
          ? Number(registro.codigo_cliente)
          : null,
      cliente: padronizarNomeLegadoNullable(registro.cliente),
      crf: registro.crf?.trim() || null,
      ufCrf: registro.uf_crf?.trim() || null,
      nomePrescritor: padronizarNomeLegadoNullable(registro.nome_prescritor),
      dataRetirada: registro.data_retirada || null,
      horaRetirada: registro.hora_retirada || null,
    };

    if (!etapa) {
      etapa = this.etapaRepository.create(payload);
    } else {
      Object.assign(etapa, payload);
    }

    await this.etapaRepository.save(etapa);
    return foiCriado;
  }
}
