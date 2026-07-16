import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PainelMedicoRepresentante } from './entities/painel-medico-representante.entity';
import { PainelMedicoRepresentanteHistorico } from './entities/painel-medico-representante-historico.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import { MotivoRemocaoPainel } from '../../common/enums/motivo-remocao-painel.enum';
import {
  buildPainelChave,
  parsePainelContratoRepresentantes,
  PainelContratoRepresentantesConfig,
} from '../../common/utils/painel-config.util';
import { padronizarNomeDeSistemaLegado } from '../../common/utils/encoding-legado.util';

export interface AgentePainelMedico {
  nome_medico: string;
  uf_crm_medico: string;
  crm_medico: string;
  contrato_representante: number;
  codigo_representante: number;
  nome_representante: string;
}

export interface PainelSyncResult {
  processados: number;
  criados: number;
  atualizados: number;
  removidos: number;
  historicoGravados: number;
}

@Injectable()
export class PainelMedicosService {
  private readonly logger = new Logger(PainelMedicosService.name);

  private readonly agenteUnidadeMap: Record<string, Unidade> = {
    inhumas: Unidade.INHUMAS,
    uberaba: Unidade.UBERABA,
    neropolis: Unidade.NERÓPOLIS,
  };

  constructor(
    @InjectRepository(PainelMedicoRepresentante)
    private readonly painelRepository: Repository<PainelMedicoRepresentante>,
    @InjectRepository(PainelMedicoRepresentanteHistorico)
    private readonly historicoRepository: Repository<PainelMedicoRepresentanteHistorico>,
  ) {}

  getUnidadePorAgente(agente: string): Unidade {
    const unidade = this.agenteUnidadeMap[agente];
    if (!unidade) {
      throw new Error(`Unidade não mapeada para o agente: ${agente}`);
    }
    return unidade;
  }

  async buscarDoAgente(
    url: string,
    token: string,
    config: PainelContratoRepresentantesConfig,
    agente: string,
  ): Promise<AgentePainelMedico[]> {
    const cdfunParam = config.cdfun.join(',');
    const urlCompleta = `${url}/api/v1/painel/medicos-representantes?cdcon=${config.cdcon}&cdfun=${encodeURIComponent(cdfunParam)}`;

    this.logger.log(`[${agente}] Chamando agente painel: ${urlCompleta}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(urlCompleta, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Erro ao buscar painel do agente: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();
      return data.medicos_representantes || [];
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout ao buscar painel do agente');
      }
      throw error;
    }
  }

  async sincronizar(
    agente: string,
    configRaw: string,
    registrosAgente: AgentePainelMedico[],
  ): Promise<PainelSyncResult> {
    const painelConfig = parsePainelContratoRepresentantes(configRaw);
    if (!painelConfig) {
      return {
        processados: 0,
        criados: 0,
        atualizados: 0,
        removidos: 0,
        historicoGravados: 0,
      };
    }

    const unidade = this.getUnidadePorAgente(agente);
    const resultado: PainelSyncResult = {
      processados: 0,
      criados: 0,
      atualizados: 0,
      removidos: 0,
      historicoGravados: 0,
    };

    const chavesRetornadas = new Set<string>();

    for (const registro of registrosAgente) {
      resultado.processados++;
      const chave = buildPainelChave(
        String(registro.crm_medico).trim(),
        String(registro.uf_crm_medico).trim(),
        registro.contrato_representante,
        registro.codigo_representante,
      );
      chavesRetornadas.add(chave);

      const existente = await this.painelRepository.findOne({
        where: {
          unidade,
          crmMedico: String(registro.crm_medico).trim(),
          ufCrmMedico: String(registro.uf_crm_medico).trim(),
          contratoRepresentante: registro.contrato_representante,
          codigoRepresentante: registro.codigo_representante,
        },
      });

      const payload: Partial<PainelMedicoRepresentante> = {
        unidade,
        nomeMedico: padronizarNomeDeSistemaLegado(registro.nome_medico),
        ufCrmMedico: String(registro.uf_crm_medico).trim(),
        crmMedico: String(registro.crm_medico).trim(),
        contratoRepresentante: registro.contrato_representante,
        codigoRepresentante: registro.codigo_representante,
        nomeRepresentante: padronizarNomeDeSistemaLegado(
          registro.nome_representante,
        ),
      };

      if (!existente) {
        await this.painelRepository.save(this.painelRepository.create(payload));
        resultado.criados++;
      } else {
        Object.assign(existente, payload);
        await this.painelRepository.save(existente);
        resultado.atualizados++;
      }
    }

    const ativosEscopo = await this.painelRepository.find({
      where: {
        unidade,
        contratoRepresentante: painelConfig.cdcon,
        codigoRepresentante: In(painelConfig.cdfun),
      },
    });

    const paraRemover = ativosEscopo.filter((item) => {
      const chave = buildPainelChave(
        item.crmMedico,
        item.ufCrmMedico,
        item.contratoRepresentante,
        item.codigoRepresentante,
      );
      return !chavesRetornadas.has(chave);
    });

    if (paraRemover.length) {
      const historicoGravados = await this.moverParaHistorico(
        paraRemover,
        MotivoRemocaoPainel.NAO_CONSTA_ERP,
        painelConfig.raw,
      );
      resultado.removidos = paraRemover.length;
      resultado.historicoGravados += historicoGravados;
    }

    this.logger.log(
      `[${agente}] Painel: ${resultado.criados} criados, ${resultado.atualizados} atualizados, ${resultado.removidos} removidos`,
    );

    return resultado;
  }

  async limparForaDoEscopoConfig(
    agente: string,
    configAntigaRaw: string | null | undefined,
    configNovaRaw: string | null | undefined,
  ): Promise<number> {
    const unidade = this.getUnidadePorAgente(agente);
    const configAntiga = configAntigaRaw
      ? parsePainelContratoRepresentantes(configAntigaRaw)
      : null;
    const configNova = configNovaRaw
      ? parsePainelContratoRepresentantes(configNovaRaw)
      : null;

    const ativos = await this.painelRepository.find({ where: { unidade } });
    const paraRemover = ativos.filter((item) => {
      const noEscopoAntigo =
        configAntiga &&
        item.contratoRepresentante === configAntiga.cdcon &&
        configAntiga.cdfun.includes(item.codigoRepresentante);

      const noEscopoNovo =
        configNova &&
        item.contratoRepresentante === configNova.cdcon &&
        configNova.cdfun.includes(item.codigoRepresentante);

      if (configNova) {
        return !noEscopoNovo;
      }

      return !!noEscopoAntigo || !configAntiga;
    });

    if (!paraRemover.length) {
      return 0;
    }

    return this.moverParaHistorico(
      paraRemover,
      MotivoRemocaoPainel.CONFIG_ALTERADA,
      configAntiga?.raw ?? configNova?.raw ?? null,
    );
  }

  private async moverParaHistorico(
    registros: PainelMedicoRepresentante[],
    motivo: MotivoRemocaoPainel,
    configNoMomento: string | null,
  ): Promise<number> {
    if (!registros.length) {
      return 0;
    }

    const agora = new Date();
    const historicos = registros.map((registro) =>
      this.historicoRepository.create({
        unidade: registro.unidade,
        nomeMedico: registro.nomeMedico,
        ufCrmMedico: registro.ufCrmMedico,
        crmMedico: registro.crmMedico,
        contratoRepresentante: registro.contratoRepresentante,
        codigoRepresentante: registro.codigoRepresentante,
        nomeRepresentante: registro.nomeRepresentante,
        configNoMomento,
        motivoRemocao: motivo,
        removidoEm: agora,
        origemPainelId: registro.id,
        criadoEmPainel: registro.criadoEm,
      }),
    );

    await this.historicoRepository.save(historicos);
    await this.painelRepository.remove(registros);

    return historicos.length;
  }
}
