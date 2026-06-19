import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SincronizacaoConfig } from './entities/sincronizacao-config.entity';
import { Cliente } from '../clientes/entities/cliente.entity';
import { Prescritor } from '../prescritores/entities/prescritor.entity';
import { Orcamento } from '../orcamentos/entities/orcamento.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import { OrcamentoStatus } from '../../common/enums/orcamento-status.enum';

interface AgenteCliente {
  cdcli: number;
  nomecli: string;
  nrcnpj?: string;
  email?: string;
  dtnas?: string;
  cdfil: number;
  dtcad: string;
}

interface AgentePrescritor {
  nrcrm?: number;
  ufcrm?: string;
  nomemed: string;
  dtcad: string;
}

interface AgenteOrcamento {
  ultima_modificacao: string;
  filial: number;
  data_orcamento: string;
  nrorc: number;
  serieo: string;
  nr_orcamento: string;
  status_orcamento: 'APROVADO' | 'REJEITADO';
  preco_venda: number;
  preco_cobrado: number;
  desconto_formula: number;
  codigo_cliente?: number | null;
  nome_cliente?: string | null;
  codigo_vendedor?: number | null;
  nome_vendedor?: string | null;
}

export interface SincronizacaoResult {
  agente: string;
  clientesProcessados: number;
  clientesCriados: number;
  clientesAtualizados: number;
  prescritoresProcessados: number;
  prescritoresCriados: number;
  prescritoresAtualizados: number;
  orcamentosProcessados: number;
  orcamentosCriados: number;
  orcamentosAtualizados: number;
  erros: string[];
}

export type SincronizacaoProgressEtapa =
  | 'iniciando'
  | 'buscando'
  | 'clientes'
  | 'prescritores'
  | 'orcamentos'
  | 'finalizando'
  | 'concluido';

export interface SincronizacaoProgress {
  status: 'running' | 'completed' | 'error';
  message: string;
  agenteAtual: string;
  etapa: SincronizacaoProgressEtapa;
  totalAgentes: number;
  agentesProcessados: number;
  /** Progresso geral da sincronização (0–100) */
  percentual: number;
  /** Totais acumulados em todos os agentes */
  clientesProcessados: number;
  prescritoresProcessados: number;
  orcamentosProcessados: number;
  /** Progresso do lote atual do agente */
  clientesAtual: number;
  clientesTotal: number;
  percentualClientes: number;
  prescritoresAtual: number;
  prescritoresTotal: number;
  percentualPrescritores: number;
  orcamentosAtual: number;
  orcamentosTotal: number;
  percentualOrcamentos: number;
  erros: number;
}

@Injectable()
export class SincronizacaoService {
  private readonly logger = new Logger(SincronizacaoService.name);
  private isRunning = false;
  private syncProgress: SincronizacaoProgress | null = null;
  private progressAgenteIndice = 0;
  private progressTotalAgentes = 0;
  private progressFase = 0;

  // Mapeamento de código de unidade (Firebird) para enum Unidade
  private readonly unidadeMap: Record<number, Unidade> = {
    2: Unidade.INHUMAS,
    4: Unidade.NERÓPOLIS,
  };

  // Mapeamento de agente para unidade
  private readonly agenteUnidadeMap: Record<string, Unidade> = {
    inhumas: Unidade.INHUMAS,
    uberaba: Unidade.UBERABA,
    neropolis: Unidade.NERÓPOLIS,
  };

  // Mapeamento de agente para cdfil (código de unidade no Firebird)
  private readonly agenteCdfilMap: Record<string, number> = {
    inhumas: 2,
    uberaba: 2,
    neropolis: 4,
  };

  constructor(
    @InjectRepository(SincronizacaoConfig)
    private readonly configRepository: Repository<SincronizacaoConfig>,
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
    @InjectRepository(Prescritor)
    private readonly prescritorRepository: Repository<Prescritor>,
    @InjectRepository(Orcamento)
    private readonly orcamentoRepository: Repository<Orcamento>,
    private readonly configService: ConfigService,
  ) {}

  getProgress(): SincronizacaoProgress | null {
    return this.syncProgress;
  }

  private iniciarProgresso(totalAgentes: number): void {
    this.progressAgenteIndice = 0;
    this.progressTotalAgentes = totalAgentes;
    this.progressFase = 0;
    this.syncProgress = {
      status: 'running',
      message: 'Iniciando sincronização...',
      agenteAtual: '',
      etapa: 'iniciando',
      totalAgentes,
      agentesProcessados: 0,
      percentual: 0,
      clientesProcessados: 0,
      prescritoresProcessados: 0,
      orcamentosProcessados: 0,
      clientesAtual: 0,
      clientesTotal: 0,
      percentualClientes: 0,
      prescritoresAtual: 0,
      prescritoresTotal: 0,
      percentualPrescritores: 0,
      orcamentosAtual: 0,
      orcamentosTotal: 0,
      percentualOrcamentos: 0,
      erros: 0,
    };
  }

  private finalizarProgresso(
    status: 'completed' | 'error',
    message: string,
  ): void {
    if (!this.syncProgress) return;
    this.syncProgress.status = status;
    this.syncProgress.message = message;
    this.syncProgress.etapa = status === 'completed' ? 'concluido' : this.syncProgress.etapa;
    this.syncProgress.percentual = status === 'completed' ? 100 : this.syncProgress.percentual;
  }

  private atualizarProgresso(
    partial: Partial<SincronizacaoProgress> & { fase?: number },
  ): void {
    if (!this.syncProgress) return;

    if (partial.fase !== undefined) {
      this.progressFase = partial.fase;
      delete partial.fase;
    }

    Object.assign(this.syncProgress, partial);
    this.syncProgress.percentual = this.calcularPercentualProgresso();
  }

  private calcularPercentualProgresso(): number {
    if (this.progressTotalAgentes <= 0) return 0;

    const slice = 100 / this.progressTotalAgentes;
    const base = this.progressAgenteIndice * slice;
    const sub = this.progressFase * slice;
    return Math.min(99, Math.round(base + sub));
  }

  private definirAgenteProgresso(indice: number, agente: string): void {
    this.progressAgenteIndice = indice;
    this.progressFase = 0.05;
    this.atualizarProgresso({
      agenteAtual: agente,
      etapa: 'buscando',
      message: `Conectando ao agente ${agente}...`,
      agentesProcessados: indice,
      clientesAtual: 0,
      clientesTotal: 0,
      percentualClientes: 0,
      prescritoresAtual: 0,
      prescritoresTotal: 0,
      percentualPrescritores: 0,
      orcamentosAtual: 0,
      orcamentosTotal: 0,
      percentualOrcamentos: 0,
    });
  }

  private calcularPercentualParcial(atual: number, total: number): number {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((atual / total) * 100));
  }

  private atualizarProgressoEtapa(
    tipo: 'clientes' | 'prescritores' | 'orcamentos',
    atual: number,
    total: number,
    fase: number,
    message: string,
  ): void {
    const percentual = this.calcularPercentualParcial(atual, total);
    const partial: Partial<SincronizacaoProgress> & { fase?: number } = {
      fase,
      message,
      etapa: tipo,
    };

    if (tipo === 'clientes') {
      partial.clientesAtual = atual;
      partial.clientesTotal = total;
      partial.percentualClientes = percentual;
    } else if (tipo === 'prescritores') {
      partial.prescritoresAtual = atual;
      partial.prescritoresTotal = total;
      partial.percentualPrescritores = percentual;
    } else {
      partial.orcamentosAtual = atual;
      partial.orcamentosTotal = total;
      partial.percentualOrcamentos = percentual;
    }

    this.atualizarProgresso(partial);
  }

  /**
   * Executa sincronização para todos os agentes ativos
   */
  async executarSincronizacao(): Promise<SincronizacaoResult[]> {
    if (this.isRunning) {
      this.logger.warn('Sincronização já está em execução');
      return [];
    }

    this.isRunning = true;
    const resultados: SincronizacaoResult[] = [];

    try {
      const configs = await this.configRepository.find({
        where: { ativo: true },
      });

      if (configs.length === 0) {
        this.logger.log('Nenhuma configuração de sincronização ativa encontrada');
        this.iniciarProgresso(0);
        this.finalizarProgresso('completed', 'Nenhum agente ativo para sincronizar');
        return [];
      }

      this.iniciarProgresso(configs.length);

      for (let i = 0; i < configs.length; i++) {
        const config = configs[i];
        this.definirAgenteProgresso(i, config.agente);
        try {
          const resultado = await this.sincronizarAgente(config);
          resultados.push(resultado);
          if (this.syncProgress) {
            this.syncProgress.erros += resultado.erros.length;
          }
        } catch (error) {
          this.logger.error(
            `Erro ao sincronizar agente ${config.agente}:`,
            error,
          );
          resultados.push({
            agente: config.agente,
            clientesProcessados: 0,
            clientesCriados: 0,
            clientesAtualizados: 0,
            prescritoresProcessados: 0,
            prescritoresCriados: 0,
            prescritoresAtualizados: 0,
            orcamentosProcessados: 0,
            orcamentosCriados: 0,
            orcamentosAtualizados: 0,
            erros: [error.message || 'Erro desconhecido'],
          });
          if (this.syncProgress) {
            this.syncProgress.erros += 1;
          }
        }

        this.progressFase = 1;
        this.atualizarProgresso({
          agentesProcessados: i + 1,
          etapa: i + 1 >= configs.length ? 'finalizando' : 'buscando',
          message:
            i + 1 >= configs.length
              ? 'Finalizando sincronização...'
              : `Agente ${config.agente} concluído`,
        });
      }

      this.finalizarProgresso('completed', 'Sincronização concluída com sucesso!');
    } catch (error: any) {
      // Se a tabela não existir ainda (erro 42P01), retorna array vazio
      if (error?.code === '42P01' || error?.driverError?.code === '42P01') {
        this.logger.debug(
          'Tabela sincronizacao_config ainda não existe. Execute a migration primeiro.',
        );
        return [];
      }
      // Para outros erros, propaga
      this.finalizarProgresso('error', error?.message || 'Erro na sincronização');
      throw error;
    } finally {
      this.isRunning = false;
    }

    return resultados;
  }
  async sincronizarAgente(
    config: SincronizacaoConfig,
  ): Promise<SincronizacaoResult> {
    this.logger.log(`Iniciando sincronização para agente: ${config.agente}`);
    this.logger.debug(`Config recebida: ${JSON.stringify({
      agente: config.agente,
      ultimaDataCliente: config.ultimaDataCliente,
      ultimaDataPrescritor: config.ultimaDataPrescritor,
      intervaloMinutos: config.intervaloMinutos,
      ativo: config.ativo,
    })}`);

    const agentesConfig = this.configService.get('agentes');
    const agenteConfig = agentesConfig[config.agente];

    if (!agenteConfig || !agenteConfig.url || !agenteConfig.token) {
      throw new Error(
        `Configuração do agente ${config.agente} não encontrada ou incompleta`,
      );
    }

    const resultado: SincronizacaoResult = {
      agente: config.agente,
      clientesProcessados: 0,
      clientesCriados: 0,
      clientesAtualizados: 0,
      prescritoresProcessados: 0,
      prescritoresCriados: 0,
      prescritoresAtualizados: 0,
      orcamentosProcessados: 0,
      orcamentosCriados: 0,
      orcamentosAtualizados: 0,
      erros: [],
    };

    // Preparar datas mínimas (já vêm como string YYYY-MM-DD do transformer)
    const dataMinimaCliente = config.ultimaDataCliente
      ? (typeof config.ultimaDataCliente === 'string' 
          ? config.ultimaDataCliente 
          : this.formatDate(config.ultimaDataCliente))
      : '2000-01-01';
    const dataMinimaPrescritor = config.ultimaDataPrescritor
      ? (typeof config.ultimaDataPrescritor === 'string'
          ? config.ultimaDataPrescritor
          : this.formatDate(config.ultimaDataPrescritor))
      : '2000-01-01';

    // Log dos parâmetros que serão enviados ao agente
    const unit = this.agenteCdfilMap[config.agente];
    this.logger.log(`Parâmetros da sincronização para agente ${config.agente}:`);
    this.logger.log(`  - URL: ${agenteConfig.url}`);
    this.logger.log(`  - Unit (cdfil): ${unit}`);
    this.logger.log(`  - dataMinimaCliente: ${dataMinimaCliente}`);
    this.logger.log(`  - dataMinimaPrescritor: ${dataMinimaPrescritor}`);

    // Buscar clientes e prescritores em uma única chamada (otimizado)
    try {
      this.atualizarProgresso({
        etapa: 'buscando',
        message: `Buscando clientes e prescritores (${config.agente})...`,
        fase: 0.1,
      });

      const dadosSincronizacao = await this.buscarDadosSincronizacaoDoAgente(
        agenteConfig.url,
        agenteConfig.token,
        dataMinimaCliente,
        dataMinimaPrescritor,
        config.agente,
      );

      const { clientes, prescritores } = dadosSincronizacao;

      // Processar clientes
      if (clientes && clientes.length > 0) {
        this.logger.log(`Processando ${clientes.length} clientes do agente ${config.agente}...`);
        this.atualizarProgresso({
          etapa: 'clientes',
          message: `Processando ${clientes.length} clientes (${config.agente})...`,
          fase: 0.15,
          clientesAtual: 0,
          clientesTotal: clientes.length,
          percentualClientes: 0,
        });
        for (let ci = 0; ci < clientes.length; ci++) {
          const clienteAgente = clientes[ci];
          try {
            resultado.clientesProcessados++;
            const foiCriado = await this.processarCliente(clienteAgente, config.agente);
            if (foiCriado) {
              resultado.clientesCriados++;
            } else {
              resultado.clientesAtualizados++;
            }
          } catch (error: any) {
            this.logger.error(
              `Erro ao processar cliente ${clienteAgente.nomecli} do agente ${config.agente}:`,
              error,
            );
            resultado.erros.push(
              `Cliente ${clienteAgente.nomecli}: ${error.message}`,
            );
          }

          if (this.syncProgress) {
            this.syncProgress.clientesProcessados++;
            if (ci % 10 === 0 || ci === clientes.length - 1) {
              const ratio = (ci + 1) / clientes.length;
              this.atualizarProgressoEtapa(
                'clientes',
                ci + 1,
                clientes.length,
                0.15 + ratio * 0.25,
                `Clientes ${ci + 1}/${clientes.length} (${config.agente})`,
              );
            }
          }
        }

        // CORREÇÃO: Usar a maior data dos registros retornados, não comparar com data inicial
        const maxDataCliente = clientes.reduce((max: string | null, c) => {
          const data = String(c.dtcad || '').trim();
          
          // Log para debug
          this.logger.debug(`[${config.agente}] Cliente dtcad original: ${c.dtcad}, tipo: ${typeof c.dtcad}, após String(): ${data}`);
          
          // Validar formato YYYY-MM-DD
          if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
            this.logger.warn(`[${config.agente}] Data de cliente inválida ou formato incorreto: "${data}"`);
            return max;
          }
          // Se max é null ou data é maior, usar data
          return !max || data > max ? data : max;
        }, null);

        // CORREÇÃO: Só atualizar se encontrou uma data válida nos registros
        if (maxDataCliente) {
          config.ultimaDataCliente = maxDataCliente as any;
          this.logger.log(`[${config.agente}] Atualizando última data de clientes para: ${maxDataCliente}`);
        } else {
          this.logger.warn(`[${config.agente}] Nenhuma data válida encontrada nos clientes retornados. Mantendo data atual: ${config.ultimaDataCliente}`);
          this.logger.debug(`[${config.agente}] Primeiras 3 datas de clientes: ${clientes.slice(0, 3).map(c => c.dtcad).join(', ')}`);
        }
      }

      // Processar prescritores
      if (prescritores && prescritores.length > 0) {
        this.logger.log(`Processando ${prescritores.length} prescritores do agente ${config.agente}...`);
        this.atualizarProgresso({
          etapa: 'prescritores',
          message: `Processando ${prescritores.length} prescritores (${config.agente})...`,
          fase: 0.45,
          prescritoresAtual: 0,
          prescritoresTotal: prescritores.length,
          percentualPrescritores: 0,
        });
        for (let pi = 0; pi < prescritores.length; pi++) {
          const prescritorAgente = prescritores[pi];
          try {
            resultado.prescritoresProcessados++;
            const foiCriado = await this.processarPrescritor(prescritorAgente);
            if (foiCriado) {
              resultado.prescritoresCriados++;
            } else {
              resultado.prescritoresAtualizados++;
            }
          } catch (error: any) {
            this.logger.error(
              `Erro ao processar prescritor ${prescritorAgente.nomemed} do agente ${config.agente}:`,
              error,
            );
            resultado.erros.push(
              `Prescritor ${prescritorAgente.nomemed}: ${error.message}`,
            );
          }

          if (this.syncProgress) {
            this.syncProgress.prescritoresProcessados++;
            if (pi % 10 === 0 || pi === prescritores.length - 1) {
              const ratio = (pi + 1) / prescritores.length;
              this.atualizarProgressoEtapa(
                'prescritores',
                pi + 1,
                prescritores.length,
                0.45 + ratio * 0.25,
                `Prescritores ${pi + 1}/${prescritores.length} (${config.agente})`,
              );
            }
          }
        }

        // CORREÇÃO: Usar a maior data dos registros retornados
        const maxDataPrescritor = prescritores.reduce((max: string | null, p) => {
          const data = String(p.dtcad || '').trim();
          
          // Log para debug
          this.logger.debug(`[${config.agente}] Prescritor dtcad original: ${p.dtcad}, tipo: ${typeof p.dtcad}, após String(): ${data}`);
          
          // Validar formato YYYY-MM-DD
          if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
            this.logger.warn(`[${config.agente}] Data de prescritor inválida ou formato incorreto: "${data}"`);
            return max;
          }
          // Se max é null ou data é maior, usar data
          return !max || data > max ? data : max;
        }, null);

        // CORREÇÃO: Só atualizar se encontrou uma data válida nos registros
        if (maxDataPrescritor) {
          config.ultimaDataPrescritor = maxDataPrescritor as any;
          this.logger.log(`[${config.agente}] Atualizando última data de prescritores para: ${maxDataPrescritor}`);
        } else {
          this.logger.warn(`[${config.agente}] Nenhuma data válida encontrada nos prescritores retornados. Mantendo data atual: ${config.ultimaDataPrescritor}`);
          this.logger.debug(`[${config.agente}] Primeiras 3 datas de prescritores: ${prescritores.slice(0, 3).map(p => p.dtcad).join(', ')}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Erro ao sincronizar dados do agente ${config.agente}:`,
        error,
      );
      resultado.erros.push(`Sincronização: ${error.message}`);
    }

    // Sincronizar orçamentos (somente se watermark configurado)
    if (config.ultimaModificacaoOrcamento) {
      try {
        await this.sincronizarOrcamentos(config, agenteConfig.url, agenteConfig.token, resultado);
      } catch (error: any) {
        this.logger.error(
          `Erro ao sincronizar orçamentos do agente ${config.agente}:`,
          error,
        );
        resultado.erros.push(`Orçamentos: ${error.message}`);
      }
    } else {
      this.logger.log(
        `[${config.agente}] Sincronização de orçamentos ignorada: ultimaModificacaoOrcamento não configurada`,
      );
    }

    // Antes de salvar, garantir que as datas sejam strings YYYY-MM-DD
    // CORREÇÃO: Manter a data atual se não foi atualizada (não usar '2000-01-01')
    const ultimaDataClienteStr = config.ultimaDataCliente 
      ? (typeof config.ultimaDataCliente === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(config.ultimaDataCliente)
          ? config.ultimaDataCliente
          : config.ultimaDataCliente instanceof Date
            ? this.formatDate(config.ultimaDataCliente)
            : null) // CORREÇÃO: null em vez de '2000-01-01'
      : null;
    
    const ultimaDataPrescritorStr = config.ultimaDataPrescritor
      ? (typeof config.ultimaDataPrescritor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(config.ultimaDataPrescritor)
          ? config.ultimaDataPrescritor
          : config.ultimaDataPrescritor instanceof Date
            ? this.formatDate(config.ultimaDataPrescritor)
            : null) // CORREÇÃO: null em vez de '2000-01-01'
      : null;

    // CORREÇÃO: Só atualizar campos que foram modificados e são válidos
    const updateData: any = {
      ativo: config.ativo,
      intervaloMinutos: config.intervaloMinutos,
    };

    if (ultimaDataClienteStr) {
      updateData.ultimaDataCliente = ultimaDataClienteStr;
    }

    if (ultimaDataPrescritorStr) {
      updateData.ultimaDataPrescritor = ultimaDataPrescritorStr;
    }

    if (config.ultimaModificacaoOrcamento) {
      updateData.ultimaModificacaoOrcamento = String(
        config.ultimaModificacaoOrcamento,
      )
        .replace('T', ' ')
        .slice(0, 19);
    }

    // Usar update() para garantir que o transformer seja aplicado corretamente
    await this.configRepository.update(config.id, updateData);

    this.logger.log(
      `Sincronização concluída para agente ${config.agente}: ${resultado.clientesCriados} clientes, ${resultado.prescritoresCriados} prescritores, ${resultado.orcamentosCriados} orçamentos criados, ${resultado.orcamentosAtualizados} orçamentos atualizados`,
    );

    return resultado;
  }

  private async sincronizarOrcamentos(
    config: SincronizacaoConfig,
    url: string,
    token: string,
    resultado: SincronizacaoResult,
  ): Promise<void> {
    const unit = this.agenteCdfilMap[config.agente];
    if (!unit) {
      throw new Error(`Unidade não mapeada para o agente: ${config.agente}`);
    }

    const dataMinimaModificacao = this.formatDateTimeForAgent(
      config.ultimaModificacaoOrcamento,
    );

    this.logger.log(
      `[${config.agente}] Sincronizando orçamentos desde ${dataMinimaModificacao}`,
    );

    this.atualizarProgresso({
      etapa: 'orcamentos',
      message: `Buscando orçamentos (${config.agente})...`,
      fase: 0.72,
    });

    const orcamentos = await this.buscarOrcamentosDoAgente(
      url,
      token,
      dataMinimaModificacao,
      config.agente,
      unit,
    );

    if (!orcamentos.length) {
      this.logger.log(`[${config.agente}] Nenhum orçamento retornado pelo agente`);
      this.atualizarWatermarkOrcamentos(config);
      return;
    }

    const unidade =
      this.agenteUnidadeMap[config.agente] || this.unidadeMap[unit] || Unidade.INHUMAS;

    this.logger.log(
      `[${config.agente}] Processando ${orcamentos.length} orçamentos...`,
    );

    this.atualizarProgresso({
      etapa: 'orcamentos',
      message: `Processando ${orcamentos.length} orçamentos (${config.agente})...`,
      fase: 0.75,
      orcamentosAtual: 0,
      orcamentosTotal: orcamentos.length,
      percentualOrcamentos: 0,
    });

    for (let oi = 0; oi < orcamentos.length; oi++) {
      const orcamentoAgente = orcamentos[oi];
      try {
        resultado.orcamentosProcessados++;
        const foiCriado = await this.processarOrcamento(
          orcamentoAgente,
          unidade,
        );
        if (foiCriado) {
          resultado.orcamentosCriados++;
        } else {
          resultado.orcamentosAtualizados++;
        }
      } catch (error: any) {
        this.logger.error(
          `Erro ao processar orçamento ${orcamentoAgente.nr_orcamento} do agente ${config.agente}:`,
          error,
        );
        resultado.erros.push(
          `Orçamento ${orcamentoAgente.nr_orcamento}: ${error.message}`,
        );
      }

      if (this.syncProgress) {
        this.syncProgress.orcamentosProcessados++;
        if (oi % 10 === 0 || oi === orcamentos.length - 1) {
          const ratio = (oi + 1) / orcamentos.length;
          this.atualizarProgressoEtapa(
            'orcamentos',
            oi + 1,
            orcamentos.length,
            0.75 + ratio * 0.2,
            `Orçamentos ${oi + 1}/${orcamentos.length} (${config.agente})`,
          );
        }
      }
    }

    this.atualizarWatermarkOrcamentos(config);
  }

  /**
   * Atualiza watermark com hora do processamento (Brasília), alinhada ao relógio local/Firebird.
   */
  private atualizarWatermarkOrcamentos(config: SincronizacaoConfig): void {
    const watermark = this.formatarDataHoraBrasilia();
    config.ultimaModificacaoOrcamento = watermark;
    this.logger.log(
      `[${config.agente}] Watermark de orçamentos atualizado para hora do processamento (Brasília): ${watermark}`,
    );
  }

  private formatarDataHoraBrasilia(date: Date = new Date()): string {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? '00';

    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
  }

  private async buscarOrcamentosDoAgente(
    url: string,
    token: string,
    dataMinimaModificacao: string,
    agente: string,
    unit: number,
  ): Promise<AgenteOrcamento[]> {
    const urlCompleta = `${url}/api/v1/orcamentos?dataMinimaModificacao=${encodeURIComponent(dataMinimaModificacao)}&unit=${unit}`;

    this.logger.log(`[${agente}] Chamando agente orçamentos: ${urlCompleta}`);

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
          `Erro ao buscar orçamentos do agente: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();
      this.logger.log(
        `[${agente}] Resposta do agente: ${data.orcamentos?.length || 0} orçamentos`,
      );

      return data.orcamentos || [];
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout ao buscar orçamentos do agente');
      }
      throw error;
    }
  }

  private async processarOrcamento(
    orcamentoAgente: AgenteOrcamento,
    unidade: Unidade,
  ): Promise<boolean> {
    const serieo = String(orcamentoAgente.serieo ?? '').trim();
    const nrorc = Number(orcamentoAgente.nrorc ?? 0);

    let orcamento = await this.orcamentoRepository.findOne({
      where: {
        unidade,
        nrorc,
        serieo,
      },
    });

    const foiCriado = !orcamento;
    const status =
      orcamentoAgente.status_orcamento === 'APROVADO'
        ? OrcamentoStatus.APROVADO
        : OrcamentoStatus.REJEITADO;

    const payload: Partial<Orcamento> = {
      unidade,
      cdfil: Number(orcamentoAgente.filial ?? 0),
      nrorc,
      serieo,
      nrOrcamento: String(orcamentoAgente.nr_orcamento ?? `${nrorc}-${serieo}`),
      dataOrcamento: orcamentoAgente.data_orcamento,
      status,
      precoVenda: Number(orcamentoAgente.preco_venda ?? 0),
      precoCobrado: Number(orcamentoAgente.preco_cobrado ?? 0),
      descontoFormula: Number(orcamentoAgente.desconto_formula ?? 0),
      codigoCliente: orcamentoAgente.codigo_cliente ?? null,
      nomeCliente: orcamentoAgente.nome_cliente
        ? this.padronizarNome(orcamentoAgente.nome_cliente)
        : null,
      codigoVendedor: orcamentoAgente.codigo_vendedor ?? null,
      nomeVendedor: orcamentoAgente.nome_vendedor
        ? this.padronizarNome(orcamentoAgente.nome_vendedor)
        : null,
      ultimaModificacao: new Date(orcamentoAgente.ultima_modificacao),
    };

    if (!orcamento) {
      orcamento = this.orcamentoRepository.create(payload);
    } else {
      Object.assign(orcamento, payload);
    }

    await this.orcamentoRepository.save(orcamento);
    return foiCriado;
  }

  private formatDateTimeForAgent(value: Date | string | null | undefined): string {
    if (!value) {
      throw new Error('Data/hora de modificação de orçamento não configurada');
    }

    if (typeof value === 'string') {
      const normalizada = value.trim().replace(' ', 'T').slice(0, 19);
      if (/^\d{4}-\d{2}-\d{2}$/.test(normalizada)) {
        return `${normalizada}T00:00:00`;
      }
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(normalizada)) {
        return normalizada.length === 16 ? `${normalizada}:00` : normalizada;
      }
      return normalizada;
    }

    if (value instanceof Date) {
      return this.formatarDataHoraBrasilia(value);
    }

    throw new Error('Formato inválido para ultimaModificacaoOrcamento');
  }

  /**
   * Busca clientes e prescritores do agente em uma única chamada (otimizado)
   */
  private async buscarDadosSincronizacaoDoAgente(
    url: string,
    token: string,
    dataMinimaCliente: string,
    dataMinimaPrescritor: string,
    agente: string,
  ): Promise<{ clientes: AgenteCliente[]; prescritores: AgentePrescritor[] }> {
    // Obter cdfil do agente
    const unit = this.agenteCdfilMap[agente];
    if (!unit) {
      throw new Error(`Unidade não mapeada para o agente: ${agente}`);
    }

    const urlCompleta = `${url}/api/v1/sincronizacao?dataMinimaCliente=${dataMinimaCliente}&dataMinimaPrescritor=${dataMinimaPrescritor}&unit=${unit}`;
    
    this.logger.log(`[${agente}] Chamando agente: ${urlCompleta}`);
    this.logger.debug(`[${agente}] Parâmetros: dataMinimaCliente=${dataMinimaCliente}, dataMinimaPrescritor=${dataMinimaPrescritor}, unit=${unit}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 120 segundos (mais tempo para ambas as queries)

    try {
      const response = await fetch(urlCompleta, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Erro ao buscar dados de sincronização do agente: ${response.status} - ${errorText}`,
        );
      }

      const data = await response.json();
      this.logger.log(`[${agente}] Resposta do agente: ${data.clientes?.length || 0} clientes, ${data.prescritores?.length || 0} prescritores`);
      this.logger.debug(`[${agente}] Primeiros clientes: ${JSON.stringify(data.clientes?.slice(0, 3) || [])}`);
      
      return {
        clientes: data.clientes || [],
        prescritores: data.prescritores || [],
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout ao buscar dados de sincronização do agente');
      }
      throw error;
    }
  }

  /**
   * Busca clientes do agente (método legado - mantido para compatibilidade)
   */
  private async buscarClientesDoAgente(
    url: string,
    token: string,
    dataMinima: string,
  ): Promise<AgenteCliente[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos

    try {
      const response = await fetch(
        `${url}/api/v1/clientes?dataMinima=${dataMinima}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Erro ao buscar clientes do agente: ${response.status} - ${errorText}`,
        );
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout ao buscar clientes do agente');
      }
      throw error;
    }
  }

  /**
   * Busca prescritores do agente
   */
  private async buscarPrescritoresDoAgente(
    url: string,
    token: string,
    dataMinima: string,
  ): Promise<AgentePrescritor[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos

    try {
      const response = await fetch(
        `${url}/api/v1/prescritores?dataMinima=${dataMinima}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Erro ao buscar prescritores do agente: ${response.status} - ${errorText}`,
        );
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout ao buscar prescritores do agente');
      }
      throw error;
    }
  }

  /**
   * Garante que a string está em UTF-8 válido
   */
  private garantirUtf8Valido(str: string): string {
    if (!str) return str;
    
    try {
      // Tenta decodificar e re-encodar para garantir UTF-8 válido
      // Se a string já está em UTF-8 válido, isso não altera nada
      const buffer = Buffer.from(str, 'utf8');
      return buffer.toString('utf8');
    } catch (error) {
      // Se falhar, tenta remover caracteres inválidos
      this.logger.warn(`String com encoding inválido detectada, removendo caracteres inválidos: ${str.substring(0, 50)}...`);
      // Remove caracteres não-UTF-8 válidos
      return str.replace(/[\uFFFD\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');
    }
  }

  /**
   * Padroniza um nome: maiúsculas e normaliza espaços
   * CORREÇÃO: 
   * 1. Garante UTF-8 válido antes de processar
   * 2. Usa toLocaleUpperCase('pt-BR') para preservar caracteres especiais (acentos, cedilha)
   */
  private padronizarNome(nome: string): string {
    if (!nome) return nome;

    // Primeiro garante que está em UTF-8 válido
    let normalized = this.garantirUtf8Valido(nome);

    // Normaliza espaços e pontos
    normalized = normalized
      .trim()
      .replace(/\s+/g, ' ') // Normaliza múltiplos espaços para um único espaço
      .replace(/\s+\./g, '.') // Remove espaços antes de ponto
      .replace(/\.\s+/g, '. ') // Garante espaço após ponto (mas preserva . seguido de espaço)
      .trim();

    // Usa toLocaleUpperCase com locale pt-BR para preservar caracteres especiais corretamente
    // Isso garante que Ç, Á, É, etc. sejam convertidos corretamente para maiúsculas
    try {
      normalized = normalized.toLocaleUpperCase('pt-BR');
    } catch (error) {
      // Fallback para toUpperCase se toLocaleUpperCase falhar
      this.logger.warn(`Erro ao usar toLocaleUpperCase, usando toUpperCase: ${error.message}`);
      normalized = normalized.toUpperCase();
    }

    return normalized;
  }

  /**
   * Processa e salva/atualiza um cliente
   * Retorna true se foi criado, false se foi atualizado
   */
  private async processarCliente(
    clienteAgente: AgenteCliente,
    agente: string,
  ): Promise<boolean> {
    const unidade = this.agenteUnidadeMap[agente] || this.unidadeMap[clienteAgente.cdfil] || Unidade.INHUMAS;

    // Buscar cliente existente por cdcliente E unidade (mesmo código pode existir em unidades diferentes)
    let cliente = await this.clienteRepository.findOne({
      where: { 
        cdcliente: clienteAgente.cdcli,
        unidade: unidade,
      },
    });

    const foiCriado = !cliente;

    if (!cliente) {
      // Criar novo cliente
      cliente = this.clienteRepository.create({
        nome: this.padronizarNome(clienteAgente.nomecli),
        cdcliente: clienteAgente.cdcli,
        cpf: clienteAgente.nrcnpj ? this.garantirUtf8Valido(clienteAgente.nrcnpj) : undefined,
        email: clienteAgente.email ? this.garantirUtf8Valido(clienteAgente.email) : undefined,
        dataNascimento: clienteAgente.dtnas
          ? this.parseDate(clienteAgente.dtnas)
          : undefined,
        unidade,
      });
    } else {
      // Atualizar cliente existente
      cliente.nome = this.padronizarNome(clienteAgente.nomecli);
      if (clienteAgente.nrcnpj) cliente.cpf = this.garantirUtf8Valido(clienteAgente.nrcnpj);
      if (clienteAgente.email) cliente.email = this.garantirUtf8Valido(clienteAgente.email);
      if (clienteAgente.dtnas) {
        cliente.dataNascimento = this.parseDate(clienteAgente.dtnas);
      }
      // Unidade não precisa atualizar pois já está correta na busca
    }

    await this.clienteRepository.save(cliente);
    return foiCriado;
  }

  /**
   * Processa e salva/atualiza um prescritor
   * Retorna true se foi criado, false se foi atualizado
   */
  private async processarPrescritor(
    prescritorAgente: AgentePrescritor,
  ): Promise<boolean> {
    // Padronizar nome para usar na busca
    const nomePadronizado = this.padronizarNome(prescritorAgente.nomemed);
    const ufcrmValido = prescritorAgente.ufcrm ? this.garantirUtf8Valido(prescritorAgente.ufcrm) : undefined;
    
    // Buscar prescritor existente por nome + numeroCRM + UFCRM juntos
    // NUNCA buscar apenas por nome (pode ser o mesmo nome mas CRM diferente)
    let prescritor: Prescritor | null = null;
    
    if (prescritorAgente.nrcrm && ufcrmValido) {
      // Buscar por nome + CRM + UF juntos (todos os três campos)
      prescritor = await this.prescritorRepository.findOne({
        where: { 
          nome: nomePadronizado,
          numeroCRM: prescritorAgente.nrcrm,
          UFCRM: ufcrmValido,
        },
      });
    }

    const foiCriado = !prescritor;

    if (!prescritor) {
      // Criar novo prescritor (não encontrou com nome + CRM + UF)
      prescritor = this.prescritorRepository.create({
        nome: nomePadronizado,
        numeroCRM: prescritorAgente.nrcrm || undefined,
        UFCRM: ufcrmValido,
      });
    } else {
      // Atualizar prescritor existente (encontrou com nome + CRM + UF)
      // Atualizar nome se mudou
      if (prescritor.nome !== nomePadronizado) {
        prescritor.nome = nomePadronizado;
      }
      // CRM e UF já estão corretos pois foram usados na busca
    }

    await this.prescritorRepository.save(prescritor);
    return foiCriado;
  }

  /**
   * Formata data para YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Converte e valida data
   */
  private parseDate(data: string): Date | undefined {
    if (!data) return undefined;
    const date = new Date(data);
    return isNaN(date.getTime()) ? undefined : date;
  }
}
