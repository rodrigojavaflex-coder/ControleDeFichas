import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { SincronizacaoConfig } from './entities/sincronizacao-config.entity';
import { Cliente } from '../clientes/entities/cliente.entity';
import { Prescritor } from '../prescritores/entities/prescritor.entity';
import { Unidade } from '../../common/enums/unidade.enum';

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

export interface SincronizacaoResult {
  agente: string;
  clientesProcessados: number;
  clientesCriados: number;
  clientesAtualizados: number;
  prescritoresProcessados: number;
  prescritoresCriados: number;
  prescritoresAtualizados: number;
  erros: string[];
}

@Injectable()
export class SincronizacaoService {
  private readonly logger = new Logger(SincronizacaoService.name);
  private isRunning = false;

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
    private readonly configService: ConfigService,
  ) {}

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
        return [];
      }

      for (const config of configs) {
        try {
          const resultado = await this.sincronizarAgente(config);
          resultados.push(resultado);
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
            erros: [error.message || 'Erro desconhecido'],
          });
        }
      }
    } catch (error: any) {
      // Se a tabela não existir ainda (erro 42P01), retorna array vazio
      if (error?.code === '42P01' || error?.driverError?.code === '42P01') {
        this.logger.debug(
          'Tabela sincronizacao_config ainda não existe. Execute a migration primeiro.',
        );
        return [];
      }
      // Para outros erros, propaga
      throw error;
    } finally {
      this.isRunning = false;
    }

    return resultados;
  }

  /**
   * Sincroniza um agente específico
   */
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
        for (const clienteAgente of clientes) {
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
        for (const prescritorAgente of prescritores) {
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

    // Usar update() para garantir que o transformer seja aplicado corretamente
    await this.configRepository.update(config.id, updateData);

    this.logger.log(
      `Sincronização concluída para agente ${config.agente}: ${resultado.clientesCriados} clientes, ${resultado.prescritoresCriados} prescritores`,
    );

    return resultado;
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
