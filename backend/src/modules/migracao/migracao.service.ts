import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Venda } from '../vendas/entities/venda.entity';
import { Cliente } from '../clientes/entities/cliente.entity';
import { Vendedor } from '../vendedores/entities/vendedor.entity';
import { Prescritor } from '../prescritores/entities/prescritor.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import { FirebirdConnectionService } from './firebird-connection.service';

export interface MigracaoResult {
  totalVendas: number;
  clientesCriados: number;
  vendedoresCriados: number;
  prescritoresCriados: number;
  vendasAtualizadas: number;
  erros: Array<{ vendaId: string; protocolo: string; motivo: string }>;
}

interface LegacyCliente {
  CDCLIENTE: number;
  CPF: string;
  NOME: string;
  EMAIL: string;
  DATANASCIMENTO: Date;
  UNIDADE: number; // cdfil
}

interface LegacyVendedor {
  CDVENDEDOR: number; // cdfun
  UNIDADE: number; // cdcon
  NOME: string; // nomefun
}

interface LegacyPrescritor {
  NRCRM: number;
  UFCRM: string;
  NOME: string; // nomemed
}

export interface MigracaoProgress {
  totalVendas: number;
  vendasProcessadas: number;
  clientesCriados: number;
  vendedoresCriados: number;
  prescritoresCriados: number;
  vendasAtualizadas: number;
  erros: number;
  status: 'running' | 'completed' | 'error';
  message?: string;
}

export interface MigracaoCadastrosProgress {
  totalClientes: number;
  clientesProcessados: number;
  clientesCriados: number;
  totalPrescritores: number;
  prescritoresProcessados: number;
  prescritoresCriados: number;
  erros: number;
  status: 'running' | 'completed' | 'error';
  message?: string;
  etapa: 'clientes' | 'prescritores' | 'concluido';
}

@Injectable()
export class MigracaoService {
  private readonly logger = new Logger(MigracaoService.name);
  private migrationProgress: MigracaoProgress | null = null;
  private migrationRunning = false;
  private cadastrosProgress: MigracaoCadastrosProgress | null = null;
  private cadastrosRunning = false;

  // Mapeamento de código de unidade (Firebird) para enum Unidade
  private readonly unidadeMap: Record<number, Unidade> = {
    2: Unidade.INHUMAS, // ou UBERABA dependendo do banco
    4: Unidade.NERÓPOLIS,
  };

  constructor(
    @InjectRepository(Venda)
    private readonly vendaRepository: Repository<Venda>,
    @InjectRepository(Cliente)
    private readonly clienteRepository: Repository<Cliente>,
    @InjectRepository(Vendedor)
    private readonly vendedorRepository: Repository<Vendedor>,
    @InjectRepository(Prescritor)
    private readonly prescritorRepository: Repository<Prescritor>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly firebirdService: FirebirdConnectionService,
  ) {}

  /**
   * Normaliza nome para busca (remove acentos, espaços extras, uppercase)
   * Melhorado para lidar com encoding corretamente
   */
  private normalizarNome(nome: string): string {
    if (!nome) return '';
    
    return nome
      .trim()
      .toUpperCase()
      .normalize('NFD') // Decompõe caracteres acentuados
      .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
      .replace(/[Çç]/g, 'C') // Tratamento específico para Ç
      .replace(/[Ññ]/g, 'N') // Tratamento específico para Ñ
      .replace(/\s+/g, ' ') // Normaliza espaços múltiplos
      .trim();
  }

  /**
   * Converte e valida data do Firebird para Date válida
   * Retorna undefined se a data for inválida
   */
  private parseDate(data: any): Date | undefined {
    if (!data) return undefined;
    
    // Se já for Date, valida
    if (data instanceof Date) {
      return isNaN(data.getTime()) ? undefined : data;
    }
    
    // Se for string, converte
    if (typeof data === 'string') {
      const trimmed = data.trim();
      // Ignora datas inválidas comuns do Firebird
      if (!trimmed || trimmed === '0000-00-00' || trimmed === '1899-12-30' || trimmed === '1900-01-01') {
        return undefined;
      }
      const date = new Date(trimmed);
      return isNaN(date.getTime()) ? undefined : date;
    }
    
    // Tenta converter para Date
    try {
      const date = new Date(data);
      // Verifica se é uma data válida (não é 1899-12-30 que é padrão do Firebird para datas vazias)
      if (isNaN(date.getTime())) return undefined;
      
      const year = date.getFullYear();
      // Ignora anos inválidos comuns do Firebird
      if (year < 1900 || year > 2100) return undefined;
      
      return date;
    } catch {
      return undefined;
    }
  }

  /**
   * Converte código de unidade do Firebird para enum Unidade
   */
  private codigoUnidadeParaEnum(
    codigo: number,
    banco: 'banco1' | 'banco2',
  ): Unidade {
    if (banco === 'banco2') {
      // Banco 2 = UBERABA
      return Unidade.UBERABA;
    }
    // Banco 1: código 2 = INHUMAS, código 4 = NERÓPOLIS
    return this.unidadeMap[codigo] || Unidade.INHUMAS;
  }

  /**
   * Busca cliente no banco legado
   */
  private async buscarClienteLegado(
    nome: string,
    banco: 'banco1' | 'banco2',
  ): Promise<LegacyCliente | null> {
    const nomeNormalizado = this.normalizarNome(nome);

    const sql = `
      SELECT 
        cliente.cdcli AS cdcliente,
        cliente.nrcnpj AS cpf,
        cliente.nomecli AS nome,
        cliente.email,
        cliente.dtnas AS datanascimento,
        cliente.cdfil AS unidade
      FROM fc07000 cliente
      WHERE UPPER(TRIM(cliente.nomecli)) = ?
    `;

    try {
      const results = banco === 'banco1'
        ? await this.firebirdService.queryBanco1<LegacyCliente>(sql, [nomeNormalizado])
        : await this.firebirdService.queryBanco2<LegacyCliente>(sql, [nomeNormalizado]);

      // Filtrar por nome normalizado (já que Firebird não remove acentos nativamente)
      const match = results.find(
        (c) => this.normalizarNome(c.NOME) === nomeNormalizado,
      );

      return match || null;
    } catch (error) {
      this.logger.error(`Erro ao buscar cliente no banco legado: ${error.message}`);
      return null;
    }
  }

  /**
   * Busca vendedor no banco legado
   */
  private async buscarVendedorLegado(
    nome: string,
    banco: 'banco1' | 'banco2',
  ): Promise<LegacyVendedor | null> {
    const nomeNormalizado = this.normalizarNome(nome);

    const sql = `
      SELECT 
        vendedor.cdfun AS cdvendedor,
        vendedor.cdcon AS unidade,
        vendedor.nomefun AS nome
      FROM fc08000 vendedor
      WHERE UPPER(TRIM(vendedor.nomefun)) = ?
    `;

    try {
      const results = banco === 'banco1'
        ? await this.firebirdService.queryBanco1<LegacyVendedor>(sql, [nomeNormalizado])
        : await this.firebirdService.queryBanco2<LegacyVendedor>(sql, [nomeNormalizado]);

      const match = results.find(
        (v) => this.normalizarNome(v.NOME) === nomeNormalizado,
      );

      return match || null;
    } catch (error) {
      this.logger.error(`Erro ao buscar vendedor no banco legado: ${error.message}`);
      return null;
    }
  }

  /**
   * Busca prescritor no banco legado
   */
  private async buscarPrescritorLegado(
    nome: string,
    banco: 'banco1' | 'banco2',
  ): Promise<LegacyPrescritor | null> {
    const nomeNormalizado = this.normalizarNome(nome);

    const sql = `
      SELECT 
        prescritor.nrcrm,
        prescritor.ufcrm,
        prescritor.nomemed AS nome
      FROM fc04000 prescritor
      WHERE UPPER(TRIM(prescritor.nomemed)) = ?
    `;

    try {
      const results = banco === 'banco1'
        ? await this.firebirdService.queryBanco1<LegacyPrescritor>(sql, [nomeNormalizado])
        : await this.firebirdService.queryBanco2<LegacyPrescritor>(sql, [nomeNormalizado]);

      const match = results.find(
        (p) => this.normalizarNome(p.NOME) === nomeNormalizado,
      );

      return match || null;
    } catch (error) {
      this.logger.error(`Erro ao buscar prescritor no banco legado: ${error.message}`);
      return null;
    }
  }

  /**
   * Busca ou cria cliente
   */
  private async buscarOuCriarCliente(
    nome: string,
    unidadeVenda: Unidade,
    banco: 'banco1' | 'banco2',
  ): Promise<Cliente> {
    const nomeNormalizado = this.normalizarNome(nome);

    // 1. Buscar no nosso banco por nome normalizado e unidade
    const clienteExistente = await this.clienteRepository
      .createQueryBuilder('cliente')
      .where('UPPER(TRIM(cliente.nome)) = :nome', { nome: nomeNormalizado })
      .andWhere('cliente.unidade = :unidade', { unidade: unidadeVenda })
      .getOne();

    if (clienteExistente) {
      return clienteExistente;
    }

    // 2. Buscar no banco legado
    const clienteLegado = await this.buscarClienteLegado(nome, banco);

    // 3. Determinar unidade (do legado se encontrado, senão da venda)
    let unidadeFinal = unidadeVenda;
    if (clienteLegado) {
      const unidadeLegado = this.codigoUnidadeParaEnum(
        clienteLegado.UNIDADE,
        banco,
      );
      unidadeFinal = unidadeLegado;
    }

    // 4. Criar cliente (padronizar nome para maiúsculas)
    const nomeCliente = clienteLegado?.NOME || nome;
    const novoCliente = this.clienteRepository.create({
      nome: this.padronizarNome(nomeCliente) || nome,
      cdcliente: clienteLegado?.CDCLIENTE ?? undefined,
      cpf: clienteLegado?.CPF ?? undefined,
      dataNascimento: this.parseDate(clienteLegado?.DATANASCIMENTO),
      email: clienteLegado?.EMAIL ?? undefined,
      telefone: undefined, // Não vem do legado
      unidade: unidadeFinal,
    });

    return await this.clienteRepository.save(novoCliente);
  }

  /**
   * Busca ou cria vendedor
   */
  private async buscarOuCriarVendedor(
    nome: string,
    unidadeVenda: Unidade,
    banco: 'banco1' | 'banco2',
  ): Promise<Vendedor> {
    const nomeNormalizado = this.normalizarNome(nome);

    // 1. Buscar no nosso banco
    const vendedorExistente = await this.vendedorRepository
      .createQueryBuilder('vendedor')
      .where('UPPER(TRIM(vendedor.nome)) = :nome', { nome: nomeNormalizado })
      .andWhere('vendedor.unidade = :unidade', { unidade: unidadeVenda })
      .getOne();

    if (vendedorExistente) {
      return vendedorExistente;
    }

    // 2. Buscar no banco legado
    const vendedorLegado = await this.buscarVendedorLegado(nome, banco);

    // 3. Determinar unidade
    let unidadeFinal = unidadeVenda;
    if (vendedorLegado) {
      const unidadeLegado = this.codigoUnidadeParaEnum(
        vendedorLegado.UNIDADE,
        banco,
      );
      unidadeFinal = unidadeLegado;
    }

    // 4. Criar vendedor (padronizar nome para maiúsculas)
    const nomeVendedor = vendedorLegado?.NOME || nome;
    const novoVendedor = this.vendedorRepository.create({
      nome: this.padronizarNome(nomeVendedor) || nome,
      cdVendedor: vendedorLegado?.CDVENDEDOR ?? undefined,
      unidade: unidadeFinal,
    });

    return await this.vendedorRepository.save(novoVendedor);
  }

  /**
   * Busca ou cria prescritor (sem unidade, definido pelo banco)
   */
  private async buscarOuCriarPrescritor(
    nome: string | null | undefined,
    banco: 'banco1' | 'banco2',
  ): Promise<Prescritor | null> {
    if (!nome || nome.trim() === '') {
      return null;
    }

    const nomeNormalizado = this.normalizarNome(nome);

    // 1. Buscar no nosso banco (prescritores não têm unidade, então busca por nome apenas)
    const prescritorExistente = await this.prescritorRepository
      .createQueryBuilder('prescritor')
      .where('UPPER(TRIM(prescritor.nome)) = :nome', { nome: nomeNormalizado })
      .getOne();

    if (prescritorExistente) {
      return prescritorExistente;
    }

    // 2. Buscar no banco legado
    const prescritorLegado = await this.buscarPrescritorLegado(nome, banco);

    // 3. Criar prescritor (padronizar nome para maiúsculas)
    const nomePrescritor = prescritorLegado?.NOME || nome;
    const novoPrescritor = this.prescritorRepository.create({
      nome: this.padronizarNome(nomePrescritor) || nome,
      numeroCRM: prescritorLegado?.NRCRM ?? undefined,
      UFCRM: prescritorLegado?.UFCRM ?? undefined,
    });

    return await this.prescritorRepository.save(novoPrescritor);
  }

  /**
   * Retorna o progresso atual da migração
   */
  getProgress(): MigracaoProgress | null {
    return this.migrationProgress;
  }

  /**
   * Retorna o progresso atual da migração de cadastros
   */
  getCadastrosProgress(): MigracaoCadastrosProgress | null {
    return this.cadastrosProgress;
  }

  /**
   * Padroniza dados de vendedores nas vendas antes da importação
   * Executa SQLs de padronização para corrigir nomes e unidades
   */
  private async padronizarDadosVendas(): Promise<number> {
    this.logger.log('Iniciando padronização de dados de vendedores...');
    
    const queries = [
      // 1. Atualiza vendedores com as unidades corretas
      `UPDATE public.vendas SET vendedor = 'POLYANA' WHERE vendedor ilike '%ester%' and unidade = 'NERÓPOLIS'`,
      `UPDATE public.vendas SET vendedor = 'OLIVIA' WHERE vendedor ilike '%ester%' and unidade = 'INHUMAS'`,
      `UPDATE public.vendas SET vendedor = 'POLYANA' WHERE vendedor ilike '%heline%' and unidade = 'NERÓPOLIS'`,
      `UPDATE public.vendas SET vendedor = 'OLIVIA' WHERE vendedor ilike '%heline%' and unidade = 'INHUMAS'`,
      `UPDATE public.vendas SET vendedor = 'POLYANA' WHERE vendedor ilike '%ivana%' and unidade = 'NERÓPOLIS'`,
      
      // 2. Padroniza nomes de vendedores
      `UPDATE public.vendas SET vendedor = 'GABRIELA GARCIA LIMA' WHERE vendedor ilike '%GABRIELA%' and unidade = 'INHUMAS'`,
      `UPDATE public.vendas SET vendedor = 'ISLA TAWANY DE PAIVA OLIVEIRA' WHERE vendedor ilike '%isla%' and unidade = 'INHUMAS'`,
      `UPDATE public.vendas SET vendedor = 'JULIA ALVES VILA VERDE' WHERE vendedor ilike '%julia%' and unidade = 'INHUMAS'`,
      `UPDATE public.vendas SET vendedor = 'LARISSA COSTA' WHERE vendedor ilike '%larissa%' and unidade = 'INHUMAS'`,
      `UPDATE public.vendas SET vendedor = 'OLIVIA BARBOSA VILA VERDE ALMEIDA SILVA' WHERE vendedor ilike '%OLIVIA%' and unidade = 'INHUMAS'`,
      `UPDATE public.vendas SET vendedor = 'MARIA GABRIELLA MACHADO ALVES' WHERE vendedor ilike '%maria%' and unidade = 'NERÓPOLIS'`,
      `UPDATE public.vendas SET vendedor = 'POLYANA CRYSTYNA DE OLIVEIRA' WHERE vendedor ilike '%POLYANA%' and unidade = 'NERÓPOLIS'`,
      `UPDATE public.vendas SET vendedor = 'ESTER NASCIMENTO GODINHO' WHERE vendedor ilike '%ester%' and unidade = 'UBERABA'`,
      `UPDATE public.vendas SET vendedor = 'HELINE NINES CAVACANTE' WHERE vendedor ilike '%heline%' and unidade = 'UBERABA'`,
    ];

    let totalQueriesExecutadas = 0;

    try {
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      
      for (const query of queries) {
        try {
          // Executar UPDATE
          // No PostgreSQL via TypeORM, UPDATE não retorna rowCount diretamente
          // Mas podemos usar RETURNING * para contar, ou simplesmente executar
          // Por enquanto, vamos executar e confiar que funcionou
          await queryRunner.query(query);
          totalQueriesExecutadas++;
          this.logger.debug(`Query executada: ${query.substring(0, 80)}...`);
        } catch (queryError) {
          this.logger.warn(`Erro ao executar query: ${query.substring(0, 60)}... - ${queryError.message}`);
          // Continua com as próximas queries mesmo se uma falhar
        }
      }

      await queryRunner.release();

      this.logger.log(`Padronização concluída. ${totalQueriesExecutadas} de ${queries.length} queries executadas com sucesso.`);
      return totalQueriesExecutadas;
    } catch (error) {
      this.logger.error('Erro ao padronizar dados de vendas:', error);
      throw new BadRequestException(`Erro ao padronizar dados: ${error.message}`);
    }
  }

  /**
   * Processa migração de todas as vendas
   */
  async migrarVendasParaRelacoes(): Promise<MigracaoResult> {
    // Proteção contra execução concorrente
    if (this.migrationRunning) {
      throw new BadRequestException('Migração já está em execução. Aguarde a conclusão.');
    }

    this.migrationRunning = true;
    const resultado: MigracaoResult = {
      totalVendas: 0,
      clientesCriados: 0,
      vendedoresCriados: 0,
      prescritoresCriados: 0,
      vendasAtualizadas: 0,
      erros: [],
    };

    try {
      // PASSO 1: Padronizar dados de vendedores (primeiro processamento)
      this.logger.log('Executando padronização de dados como primeiro processamento...');
      await this.padronizarDadosVendas();
      
      // Buscar todas as vendas sem relacionamento usando query raw para ler campos texto diretamente do banco
      // (os campos texto ainda existem no banco mas não mais na entity)
      const vendasRaw = await this.dataSource.query(`
        SELECT id, protocolo, "dataVenda", "dataFechamento", "dataEnvio", 
               cliente, vendedor, prescritor, "valorCompra", "valorPago", 
               "valorCliente", observacao, status, unidade, ativo, 
               "tipoAtualizacao", origem, "clienteId", "vendedorId", "prescritorId",
               "criadoEm", "atualizadoEm"
        FROM vendas
        WHERE "clienteId" IS NULL OR "vendedorId" IS NULL
      `);

      resultado.totalVendas = vendasRaw.length;
      
      // Inicializar progresso
      this.migrationProgress = {
        totalVendas: vendasRaw.length,
        vendasProcessadas: 0,
        clientesCriados: 0,
        vendedoresCriados: 0,
        prescritoresCriados: 0,
        vendasAtualizadas: 0,
        erros: 0,
        status: 'running',
      };

      this.logger.log(`Iniciando migração de ${vendasRaw.length} vendas...`);

      for (let i = 0; i < vendasRaw.length; i++) {
        const vendaRaw = vendasRaw[i];
        try {
          // Ler campos texto diretamente do resultado da query raw
          const clienteNome: string = vendaRaw.cliente;
          const vendedorNome: string = vendaRaw.vendedor;
          const prescritorNome: string | null = vendaRaw.prescritor;
          const vendaId: string = vendaRaw.id;
          const protocolo: string = vendaRaw.protocolo;

          // Determinar unidade da venda
          let unidade: Unidade;
          if (vendaRaw.unidade) {
            unidade = vendaRaw.unidade as Unidade;
          } else {
            // Fallback: tentar inferir da origem
            unidade = Unidade.INHUMAS;
          }

          // Determinar qual banco usar
          const banco = this.firebirdService.getBancoByUnidade(unidade);

          // Buscar ou criar cliente
          const clienteAntes = await this.clienteRepository
            .createQueryBuilder('cliente')
            .where('UPPER(TRIM(cliente.nome)) = :nome', { 
              nome: this.normalizarNome(clienteNome) 
            })
            .andWhere('cliente.unidade = :unidade', { unidade })
            .getOne();

          const cliente = await this.buscarOuCriarCliente(
            clienteNome,
            unidade,
            banco,
          );
          
          if (!clienteAntes) {
            resultado.clientesCriados++;
            if (this.migrationProgress) {
              this.migrationProgress.clientesCriados = resultado.clientesCriados;
            }
          }

          // Buscar ou criar vendedor
          const vendedorAntes = await this.vendedorRepository
            .createQueryBuilder('vendedor')
            .where('UPPER(TRIM(vendedor.nome)) = :nome', { 
              nome: this.normalizarNome(vendedorNome) 
            })
            .andWhere('vendedor.unidade = :unidade', { unidade })
            .getOne();

          const vendedor = await this.buscarOuCriarVendedor(
            vendedorNome,
            unidade,
            banco,
          );
          
          if (!vendedorAntes) {
            resultado.vendedoresCriados++;
            if (this.migrationProgress) {
              this.migrationProgress.vendedoresCriados = resultado.vendedoresCriados;
            }
          }

          // Buscar ou criar prescritor (usa o banco, não a unidade)
          let prescritorAntes: Prescritor | null = null;
          if (prescritorNome) {
            prescritorAntes = await this.prescritorRepository
              .createQueryBuilder('prescritor')
              .where('UPPER(TRIM(prescritor.nome)) = :nome', { 
                nome: this.normalizarNome(prescritorNome) 
              })
              .getOne();
          }

          const prescritor = await this.buscarOuCriarPrescritor(
            prescritorNome || undefined,
            banco,
          );
          
          if (prescritor && !prescritorAntes) {
            resultado.prescritoresCriados++;
            if (this.migrationProgress) {
              this.migrationProgress.prescritoresCriados = resultado.prescritoresCriados;
            }
          }

          // Atualizar apenas os relacionamentos (IDs) usando query direta
          // porque a entidade não mapeia esses campos diretamente como colunas
          await this.dataSource.query(`
            UPDATE vendas 
            SET "clienteId" = $1, "vendedorId" = $2, "prescritorId" = $3
            WHERE id = $4
          `, [cliente?.id || null, vendedor?.id || null, prescritor?.id || null, vendaId]);

          resultado.vendasAtualizadas++;
          
          // Atualizar progresso
          if (this.migrationProgress) {
            this.migrationProgress.vendasProcessadas = i + 1;
            this.migrationProgress.vendasAtualizadas = resultado.vendasAtualizadas;
            this.migrationProgress.erros = resultado.erros.length;
          }
        } catch (error) {
          this.logger.error(
            `Erro ao migrar venda ${vendaRaw.id} (${vendaRaw.protocolo}):`,
            error,
          );
          resultado.erros.push({
            vendaId: vendaRaw.id,
            protocolo: vendaRaw.protocolo || 'N/A',
            motivo: error.message,
          });
          
          // Atualizar progresso com erro
          if (this.migrationProgress) {
            this.migrationProgress.erros = resultado.erros.length;
            this.migrationProgress.vendasProcessadas = i + 1;
          }
        }
      }

      // Marcar como concluído
      if (this.migrationProgress) {
        this.migrationProgress.status = 'completed';
        this.migrationProgress.message = 'Migração concluída com sucesso!';
      }

      this.logger.log('Migração concluída com sucesso!');
      return resultado;
    } catch (error) {
      this.logger.error('Erro geral na migração:', error);
      
      // Marcar como erro
      if (this.migrationProgress) {
        this.migrationProgress.status = 'error';
        this.migrationProgress.message = error.message;
      }
      
      throw error;
    } finally {
      this.migrationRunning = false;
    }
  }

  /**
   * Executa a migration do TypeORM via API
   * Executa apenas as migrations estruturais (até 1735000002000), excluindo a de remoção de campos texto
   */
  async executarMigration(): Promise<{ message: string; success: boolean }> {
    try {
      const { AppDataSource } = require('../../data-source');
      
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }
      
      // Carregar todas as migrations disponíveis
      const allMigrations = AppDataSource.migrations || [];
      
      if (allMigrations.length === 0) {
        this.logger.log('Nenhuma migration disponível');
        
        if (AppDataSource.isInitialized) {
          await AppDataSource.destroy();
        }
        
        return { message: 'Nenhuma migration disponível', success: true };
      }
      
      // Verificar quais migrations já foram executadas consultando o banco
      const queryRunner = AppDataSource.createQueryRunner();
      
      // Verificar se a tabela migrations existe, se não existir, criar
      const migrationsTableExists = await queryRunner.hasTable('migrations');
      if (!migrationsTableExists) {
        this.logger.log('Tabela migrations não existe. Criando...');
        await queryRunner.query(`
          CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            timestamp BIGINT NOT NULL,
            name VARCHAR(255) NOT NULL,
            CONSTRAINT "UQ_migrations_timestamp_name" UNIQUE (timestamp, name)
          )
        `);
        this.logger.log('✅ Tabela migrations criada com sucesso');
      } else {
        // Verificar se a constraint UNIQUE existe, se não existir, criar
        const constraintExists = await queryRunner.query(`
          SELECT 1 
          FROM pg_constraint 
          WHERE conname = 'UQ_migrations_timestamp_name'
        `);
        
        if (constraintExists.length === 0) {
          this.logger.log('Constraint UNIQUE não existe. Criando...');
          // Tentar adicionar a constraint UNIQUE
          try {
            await queryRunner.query(`
              ALTER TABLE migrations
              ADD CONSTRAINT "UQ_migrations_timestamp_name" UNIQUE (timestamp, name)
            `);
            this.logger.log('✅ Constraint UNIQUE criada com sucesso');
          } catch (error) {
            // Se falhar (por exemplo, se já houver duplicatas), criar índice único ao invés
            this.logger.warn('Não foi possível criar constraint UNIQUE, criando índice único:', error.message);
            await queryRunner.query(`
              CREATE UNIQUE INDEX IF NOT EXISTS "UQ_migrations_timestamp_name_idx" 
              ON migrations (timestamp, name)
            `);
          }
        }
      }
      
      // Consultar migrations executadas (agora a tabela existe)
      let executedMigrations: any[] = [];
      try {
        executedMigrations = await queryRunner.query(`
          SELECT name FROM migrations ORDER BY timestamp DESC
        `);
      } catch (error) {
        this.logger.warn('Erro ao consultar migrations executadas, assumindo nenhuma:', error);
        executedMigrations = [];
      }
      
      const executedNames = new Set(executedMigrations.map((m: any) => m.name));
      
      // Filtrar apenas as migrations estruturais pendentes (timestamp <= 1735000002000)
      // Excluir a migration de remoção de campos texto (1735000003000)
      const structuralMigrations = allMigrations.filter((migration: any) => {
        // migration é uma classe de migration
        let migrationName: string;
        
        if (typeof migration === 'function') {
          migrationName = migration.name;
        } else if (migration && migration.constructor) {
          migrationName = migration.constructor.name;
        } else {
          return false; // Não é uma migration válida
        }
        
        if (!migrationName || migrationName === 'undefined') {
          return false;
        }
        
        // Verificar se já foi executada
        if (executedNames.has(migrationName)) {
          return false;
        }
        
        // Extrair timestamp do nome da migration (formato: ClassName1735000000000)
        const match = migrationName.match(/(\d+)$/);
        if (match) {
          const timestamp = parseInt(match[1], 10);
          // Executar apenas migrations estruturais (até 1735000002000)
          // Isso inclui: 1735000000000 (add-venda-relations), 1735000001000 (create-cadastros-tables), 1735000002000 (add-venda-foreign-keys)
          return timestamp <= 1735000002000;
        }
        return false;
      });
      
      // Ordenar migrations por timestamp em ordem crescente (importante para ordem de execução)
      structuralMigrations.sort((a: any, b: any) => {
        let timestampA = 0;
        let timestampB = 0;
        
        let nameA = '';
        let nameB = '';
        
        if (typeof a === 'function') {
          nameA = a.name;
        } else if (a && a.constructor) {
          nameA = a.constructor.name;
        }
        
        if (typeof b === 'function') {
          nameB = b.name;
        } else if (b && b.constructor) {
          nameB = b.constructor.name;
        }
        
        const matchA = nameA.match(/(\d+)$/);
        const matchB = nameB.match(/(\d+)$/);
        
        if (matchA) timestampA = parseInt(matchA[1], 10);
        if (matchB) timestampB = parseInt(matchB[1], 10);
        
        return timestampA - timestampB; // Ordem crescente
      });
      
      if (structuralMigrations.length === 0) {
        this.logger.log('Nenhuma migration estrutural pendente para executar');
        
        await queryRunner.release();
        
        if (AppDataSource.isInitialized) {
          await AppDataSource.destroy();
        }
        
        return { message: 'Nenhuma migration estrutural pendente para executar', success: true };
      }
      
      // Executar apenas as migrations estruturais manualmente
      await queryRunner.startTransaction();
      
      try {
        for (const migration of structuralMigrations) {
          // migration pode ser uma classe ou instância
          let MigrationClass: any;
          let migrationName: string;
          
          if (typeof migration === 'function') {
            MigrationClass = migration;
            migrationName = migration.name;
          } else {
            MigrationClass = migration.constructor;
            migrationName = migration.constructor.name;
          }
          
          if (!migrationName || migrationName === 'undefined') {
            this.logger.warn(`Migration com nome inválido, pulando...`);
            continue;
          }
          
          try {
            this.logger.log(`Executando migration estrutural: ${migrationName}`);
            
            // Instanciar a migration
            const migrationInstance = new MigrationClass();
            
            // Verificar se tem método up
            if (!migrationInstance.up || typeof migrationInstance.up !== 'function') {
              throw new Error(`Migration ${migrationName} não possui método up`);
            }
            
            // Executar o método up diretamente com o queryRunner
            await migrationInstance.up(queryRunner);
            
            // Registrar a migration como executada na tabela migrations
            const timestampMatch = migrationName.match(/(\d+)$/);
            if (timestampMatch) {
              const timestamp = parseInt(timestampMatch[1], 10);
              
              // Verificar se a constraint UNIQUE existe
              const constraintExists = await queryRunner.query(`
                SELECT 1 
                FROM pg_constraint 
                WHERE conname = 'UQ_migrations_timestamp_name'
              `);
              
              if (constraintExists.length > 0) {
                // Usar ON CONFLICT se a constraint existe
                await queryRunner.query(`
                  INSERT INTO migrations (timestamp, name)
                  VALUES ($1, $2)
                  ON CONFLICT (timestamp, name) DO NOTHING
                `, [timestamp, migrationName]);
              } else {
                // Verificar manualmente se já existe antes de inserir
                const exists = await queryRunner.query(`
                  SELECT 1 FROM migrations 
                  WHERE timestamp = $1 AND name = $2
                `, [timestamp, migrationName]);
                
                if (exists.length === 0) {
                  await queryRunner.query(`
                    INSERT INTO migrations (timestamp, name)
                    VALUES ($1, $2)
                  `, [timestamp, migrationName]);
                }
              }
            }
            
            this.logger.log(`✅ Migration ${migrationName} executada com sucesso`);
          } catch (error) {
            this.logger.error(`Erro ao executar migration ${migrationName}:`, error);
            await queryRunner.rollbackTransaction();
            await queryRunner.release();
            throw error;
          }
        }
        
        await queryRunner.commitTransaction();
      } catch (error) {
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }
        throw error;
      } finally {
        await queryRunner.release();
      }
      
      if (AppDataSource.isInitialized) {
        await AppDataSource.destroy();
      }
      
      this.logger.log(`Migrations estruturais executadas com sucesso (${structuralMigrations.length} migration(s))`);
      return { 
        message: `Migrations estruturais executadas com sucesso (${structuralMigrations.length} migration(s))`, 
        success: true 
      };
    } catch (error) {
      this.logger.error('Erro ao executar migration:', error);
      throw new BadRequestException(`Erro ao executar migration: ${error.message}`);
    }
  }

  /**
   * Executa apenas a migration que remove os campos texto
   * ⚠️ ATENÇÃO: Esta operação é IRREVERSÍVEL. Faça backup do banco antes!
   */
  async removerCamposTexto(): Promise<{ message: string; success: boolean }> {
    try {
      this.logger.warn('⚠️  ATENÇÃO: Iniciando remoção dos campos texto da tabela vendas');
      this.logger.warn('⚠️  Certifique-se de que fez backup do banco de dados!');
      
      // Primeiro, verificar se as colunas ainda existem
      const result = await this.dataSource.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'vendas' 
        AND column_name IN ('cliente', 'vendedor', 'prescritor')
      `);

      if (result.length === 0) {
        this.logger.log('✅ Os campos texto já foram removidos anteriormente');
        return {
          message: 'Os campos texto já foram removidos anteriormente.',
          success: true
        };
      }

      this.logger.log(`📋 Encontradas ${result.length} coluna(s) texto para remover: ${result.map((r: any) => r.column_name).join(', ')}`);
      
      const { AppDataSource } = require('../../data-source');
      
      if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
      }

      // Executar todas as migrations pendentes (incluindo a de remoção de campos texto)
      // O TypeORM só executa migrations que ainda não foram executadas
      const migrations = await AppDataSource.runMigrations();
      
      const targetMigration = migrations.find(
        (m: any) => m.name === 'RemoveTextFieldsFromVendas1735000003000'
      );

      // Verificar novamente se as colunas foram removidas
      const resultAfter = await this.dataSource.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'vendas' 
        AND column_name IN ('cliente', 'vendedor', 'prescritor')
      `);

      if (resultAfter.length > 0) {
        // Se a migration não foi executada (não está pendente), mas as colunas ainda existem
        if (!targetMigration) {
          throw new BadRequestException(
            `A migration já foi executada anteriormente, mas as colunas ainda existem (${resultAfter.map((r: any) => r.column_name).join(', ')}). ` +
            `Execute manualmente via: npm run migration:run ou remova as colunas manualmente via SQL.`
          );
        } else {
          // Migration foi executada mas as colunas ainda existem (erro na migration)
          throw new BadRequestException(
            `A migration foi executada, mas as colunas ainda existem. Verifique os logs para mais detalhes.`
          );
        }
      }

      this.logger.log('✅ Campos texto removidos com sucesso!');
      
      // Destruir AppDataSource se foi inicializado
      try {
        const { AppDataSource } = require('../../data-source');
        if (AppDataSource?.isInitialized) {
          await AppDataSource.destroy();
        }
      } catch (destroyError) {
        // Ignorar erro ao destruir
      }
      
      return {
        message: 'Campos texto (cliente, vendedor, prescritor) removidos com sucesso da tabela vendas.',
        success: true
      };
    } catch (error) {
      this.logger.error('❌ Erro ao remover campos texto:', error);
      
      // Destruir AppDataSource se foi inicializado
      try {
        const { AppDataSource } = require('../../data-source');
        if (AppDataSource?.isInitialized) {
          await AppDataSource.destroy();
        }
      } catch (destroyError) {
        // Ignorar erro ao destruir
      }
      
      // Se o erro já é uma BadRequestException, apenas relançar
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new BadRequestException(
        `Erro ao remover campos texto: ${error.message}. ` +
        `Verifique se todos os dados foram migrados antes de tentar novamente.`
      );
    }
  }

  /**
   * Busca todos os clientes do banco legado
   */
  private async buscarTodosClientesLegado(
    banco: 'banco1' | 'banco2',
  ): Promise<LegacyCliente[]> {
    const sql = `
      SELECT 
        cliente.cdcli AS cdcliente,
        cliente.nrcnpj AS cpf,
        cliente.nomecli AS nome,
        cliente.email,
        cliente.dtnas AS datanascimento,
        cliente.cdfil AS unidade
      FROM fc07000 cliente
      ORDER BY cliente.nomecli
    `;

    try {
      const results = banco === 'banco1'
        ? await this.firebirdService.queryBanco1<LegacyCliente>(sql, [])
        : await this.firebirdService.queryBanco2<LegacyCliente>(sql, []);
      return results || [];
    } catch (error) {
      this.logger.error(`Erro ao buscar todos os clientes no banco legado: ${error.message}`);
      return [];
    }
  }

  /**
   * Busca todos os vendedores do banco legado
   */
  private async buscarTodosVendedoresLegado(
    banco: 'banco1' | 'banco2',
  ): Promise<LegacyVendedor[]> {
    const sql = `
      SELECT 
        vendedor.cdfun AS cdvendedor,
        vendedor.cdcon AS unidade,
        vendedor.nomefun AS nome
      FROM fc08000 vendedor
      ORDER BY vendedor.nomefun
    `;

    try {
      const results = banco === 'banco1'
        ? await this.firebirdService.queryBanco1<LegacyVendedor>(sql, [])
        : await this.firebirdService.queryBanco2<LegacyVendedor>(sql, []);
      return results || [];
    } catch (error) {
      this.logger.error(`Erro ao buscar todos os vendedores no banco legado: ${error.message}`);
      return [];
    }
  }

  /**
   * Busca todos os prescritores do banco legado
   */
  private async buscarTodosPrescritoresLegado(
    banco: 'banco1' | 'banco2',
  ): Promise<LegacyPrescritor[]> {
    const sql = `
      SELECT 
        prescritor.nrcrm,
        prescritor.ufcrm,
        prescritor.nomemed AS nome
      FROM fc04000 prescritor
      ORDER BY prescritor.nomemed
    `;

    try {
      const results = banco === 'banco1'
        ? await this.firebirdService.queryBanco1<LegacyPrescritor>(sql, [])
        : await this.firebirdService.queryBanco2<LegacyPrescritor>(sql, []);
      return results || [];
    } catch (error) {
      this.logger.error(`Erro ao buscar todos os prescritores no banco legado: ${error.message}`);
      return [];
    }
  }

  /**
   * Migra todos os cadastros (clientes e prescritores) das bases legadas
   * Nota: Vendedores são migrados apenas durante a migração de vendas (migrarVendasParaRelacoes)
   */
  async migrarTodosCadastros(): Promise<{
    clientesCriados: number;
    prescritoresCriados: number;
    erros: number;
  }> {
    // Proteção contra execução concorrente
    if (this.cadastrosRunning) {
      throw new BadRequestException('Migração de cadastros já está em execução. Aguarde a conclusão.');
    }

    this.cadastrosRunning = true;
    const resultado = {
      clientesCriados: 0,
      prescritoresCriados: 0,
      erros: 0,
    };

    try {
      // Inicializar progresso
      this.cadastrosProgress = {
        totalClientes: 0,
        clientesProcessados: 0,
        clientesCriados: 0,
        totalPrescritores: 0,
        prescritoresProcessados: 0,
        prescritoresCriados: 0,
        erros: 0,
        status: 'running',
        etapa: 'clientes',
      };

      // Processar Banco 1 (INHUMAS + NERÓPOLIS)
      this.logger.log('Iniciando migração de cadastros do Banco 1 (INHUMAS/NERÓPOLIS)...');
      
      // 1. Migrar Clientes do Banco 1
      if (this.cadastrosProgress) {
        this.cadastrosProgress.etapa = 'clientes';
      }
      const clientesBanco1 = await this.buscarTodosClientesLegado('banco1');
      if (this.cadastrosProgress) {
        this.cadastrosProgress.totalClientes = clientesBanco1.length;
      }

      for (let i = 0; i < clientesBanco1.length; i++) {
        const clienteLegado = clientesBanco1[i];
        try {
          const unidade = this.codigoUnidadeParaEnum(clienteLegado.UNIDADE, 'banco1');
          const nomeNormalizado = this.normalizarNome(clienteLegado.NOME);

          // Verificar se já existe
          const existe = await this.clienteRepository
            .createQueryBuilder('cliente')
            .where('UPPER(TRIM(cliente.nome)) = :nome', { nome: nomeNormalizado })
            .andWhere('cliente.unidade = :unidade', { unidade })
            .getOne();

          if (!existe) {
            const novoCliente = this.clienteRepository.create({
              nome: this.padronizarNome(clienteLegado.NOME),
              cdcliente: clienteLegado.CDCLIENTE ?? undefined,
              cpf: clienteLegado.CPF ?? undefined,
              dataNascimento: this.parseDate(clienteLegado.DATANASCIMENTO),
              email: clienteLegado.EMAIL ?? undefined,
              telefone: undefined,
              unidade: unidade,
            });
            await this.clienteRepository.save(novoCliente);
            resultado.clientesCriados++;
          }

          if (this.cadastrosProgress) {
            this.cadastrosProgress.clientesProcessados = i + 1;
            this.cadastrosProgress.clientesCriados = resultado.clientesCriados;
          }
        } catch (error) {
          this.logger.error(`Erro ao migrar cliente ${clienteLegado.NOME}:`, error);
          resultado.erros++;
          if (this.cadastrosProgress) {
            this.cadastrosProgress.erros = resultado.erros;
            this.cadastrosProgress.clientesProcessados = i + 1;
          }
        }
      }

      // 2. Migrar Prescritores do Banco 1
      if (this.cadastrosProgress) {
        this.cadastrosProgress.etapa = 'prescritores';
      }
      const prescritoresBanco1 = await this.buscarTodosPrescritoresLegado('banco1');
      if (this.cadastrosProgress) {
        this.cadastrosProgress.totalPrescritores = prescritoresBanco1.length;
      }

      for (let i = 0; i < prescritoresBanco1.length; i++) {
        const prescritorLegado = prescritoresBanco1[i];
        try {
          const nomeNormalizado = this.normalizarNome(prescritorLegado.NOME);

          // Verificar se já existe
          const existe = await this.prescritorRepository
            .createQueryBuilder('prescritor')
            .where('UPPER(TRIM(prescritor.nome)) = :nome', { nome: nomeNormalizado })
            .getOne();

          if (!existe) {
            const novoPrescritor = this.prescritorRepository.create({
              nome: this.padronizarNome(prescritorLegado.NOME),
              numeroCRM: prescritorLegado.NRCRM ?? undefined,
              UFCRM: prescritorLegado.UFCRM ?? undefined,
            });
            await this.prescritorRepository.save(novoPrescritor);
            resultado.prescritoresCriados++;
          }

          if (this.cadastrosProgress) {
            this.cadastrosProgress.prescritoresProcessados = i + 1;
            this.cadastrosProgress.prescritoresCriados = resultado.prescritoresCriados;
          }
        } catch (error) {
          this.logger.error(`Erro ao migrar prescritor ${prescritorLegado.NOME}:`, error);
          resultado.erros++;
          if (this.cadastrosProgress) {
            this.cadastrosProgress.erros = resultado.erros;
            this.cadastrosProgress.prescritoresProcessados = i + 1;
          }
        }
      }

      // Processar Banco 2 (UBERABA)
      this.logger.log('Iniciando migração de cadastros do Banco 2 (UBERABA)...');

      // 1. Migrar Clientes do Banco 2
      if (this.cadastrosProgress) {
        this.cadastrosProgress.etapa = 'clientes';
      }
      const clientesBanco2 = await this.buscarTodosClientesLegado('banco2');
      if (this.cadastrosProgress) {
        this.cadastrosProgress.totalClientes += clientesBanco2.length;
      }

      for (let i = 0; i < clientesBanco2.length; i++) {
        const clienteLegado = clientesBanco2[i];
        try {
          const unidade = this.codigoUnidadeParaEnum(clienteLegado.UNIDADE, 'banco2');
          const nomeNormalizado = this.normalizarNome(clienteLegado.NOME);

          // Verificar se já existe
          const existe = await this.clienteRepository
            .createQueryBuilder('cliente')
            .where('UPPER(TRIM(cliente.nome)) = :nome', { nome: nomeNormalizado })
            .andWhere('cliente.unidade = :unidade', { unidade })
            .getOne();

          if (!existe) {
            const novoCliente = this.clienteRepository.create({
              nome: this.padronizarNome(clienteLegado.NOME),
              cdcliente: clienteLegado.CDCLIENTE ?? undefined,
              cpf: clienteLegado.CPF ?? undefined,
              dataNascimento: this.parseDate(clienteLegado.DATANASCIMENTO),
              email: clienteLegado.EMAIL ?? undefined,
              telefone: undefined,
              unidade: unidade,
            });
            await this.clienteRepository.save(novoCliente);
            resultado.clientesCriados++;
          }

          if (this.cadastrosProgress) {
            this.cadastrosProgress.clientesProcessados += 1;
            this.cadastrosProgress.clientesCriados = resultado.clientesCriados;
          }
        } catch (error) {
          this.logger.error(`Erro ao migrar cliente ${clienteLegado.NOME}:`, error);
          resultado.erros++;
          if (this.cadastrosProgress) {
            this.cadastrosProgress.erros = resultado.erros;
            this.cadastrosProgress.clientesProcessados += 1;
          }
        }
      }

      // 2. Migrar Prescritores do Banco 2
      if (this.cadastrosProgress) {
        this.cadastrosProgress.etapa = 'prescritores';
      }
      const prescritoresBanco2 = await this.buscarTodosPrescritoresLegado('banco2');
      if (this.cadastrosProgress) {
        this.cadastrosProgress.totalPrescritores += prescritoresBanco2.length;
      }

      for (let i = 0; i < prescritoresBanco2.length; i++) {
        const prescritorLegado = prescritoresBanco2[i];
        try {
          const nomeNormalizado = this.normalizarNome(prescritorLegado.NOME);

          // Verificar se já existe
          const existe = await this.prescritorRepository
            .createQueryBuilder('prescritor')
            .where('UPPER(TRIM(prescritor.nome)) = :nome', { nome: nomeNormalizado })
            .getOne();

          if (!existe) {
            const novoPrescritor = this.prescritorRepository.create({
              nome: this.padronizarNome(prescritorLegado.NOME),
              numeroCRM: prescritorLegado.NRCRM ?? undefined,
              UFCRM: prescritorLegado.UFCRM ?? undefined,
            });
            await this.prescritorRepository.save(novoPrescritor);
            resultado.prescritoresCriados++;
          }

          if (this.cadastrosProgress) {
            this.cadastrosProgress.prescritoresProcessados += 1;
            this.cadastrosProgress.prescritoresCriados = resultado.prescritoresCriados;
          }
        } catch (error) {
          this.logger.error(`Erro ao migrar prescritor ${prescritorLegado.NOME}:`, error);
          resultado.erros++;
          if (this.cadastrosProgress) {
            this.cadastrosProgress.erros = resultado.erros;
            this.cadastrosProgress.prescritoresProcessados += 1;
          }
        }
      }

      // Marcar como concluído
      if (this.cadastrosProgress) {
        this.cadastrosProgress.status = 'completed';
        this.cadastrosProgress.etapa = 'concluido';
        this.cadastrosProgress.message = 'Migração de cadastros concluída com sucesso!';
      }

      this.logger.log('Migração de cadastros concluída com sucesso!');
      return resultado;
    } catch (error) {
      this.logger.error('Erro geral na migração de cadastros:', error);
      
      // Marcar como erro
      if (this.cadastrosProgress) {
        this.cadastrosProgress.status = 'error';
        this.cadastrosProgress.message = error.message;
      }
      
      throw error;
    } finally {
      this.cadastrosRunning = false;
    }
  }

  /**
   * Padroniza nomes nas vendas existentes (maiúsculas e normaliza espaços)
   * ATENÇÃO: Este método será removido após a migration que remove os campos texto.
   * Usa query raw para ler os campos texto diretamente do banco (já que não existem mais na entity).
   */
  async padronizarNomesVendas(): Promise<{ vendasAtualizadas: number; erros: number }> {
    const resultado = {
      vendasAtualizadas: 0,
      erros: 0,
    };

    try {
      this.logger.log('Iniciando padronização de nomes nas vendas (usando query raw)...');

      // Buscar todas as vendas usando query raw para ler campos texto do banco
      const vendasRaw = await this.dataSource.query(`
        SELECT id, protocolo, cliente, vendedor, prescritor
        FROM vendas
        WHERE cliente IS NOT NULL OR vendedor IS NOT NULL OR prescritor IS NOT NULL
      `);

      this.logger.log(`Total de vendas para padronizar: ${vendasRaw.length}`);

      // Processar cada venda
      for (const vendaRaw of vendasRaw) {
        try {
          const updates: string[] = [];

          // Padronizar nome do cliente
          if (vendaRaw.cliente) {
            const clienteNormalizado = this.padronizarNome(vendaRaw.cliente);
            if (clienteNormalizado !== vendaRaw.cliente) {
              updates.push(`cliente = '${clienteNormalizado.replace(/'/g, "''")}'`);
            }
          }

          // Padronizar nome do vendedor
          if (vendaRaw.vendedor) {
            const vendedorNormalizado = this.padronizarNome(vendaRaw.vendedor);
            if (vendedorNormalizado !== vendaRaw.vendedor) {
              updates.push(`vendedor = '${vendedorNormalizado.replace(/'/g, "''")}'`);
            }
          }

          // Padronizar nome do prescritor
          if (vendaRaw.prescritor) {
            const prescritorNormalizado = this.padronizarNome(vendaRaw.prescritor);
            if (prescritorNormalizado !== vendaRaw.prescritor) {
              updates.push(`prescritor = '${prescritorNormalizado.replace(/'/g, "''")}'`);
            }
          }

          // Atualizar se houve alteração
          if (updates.length > 0) {
            await this.dataSource.query(`
              UPDATE vendas 
              SET ${updates.join(', ')}
              WHERE id = $1
            `, [vendaRaw.id]);
            resultado.vendasAtualizadas++;
          }
        } catch (error) {
          this.logger.error(
            `Erro ao padronizar venda ${vendaRaw.id} (${vendaRaw.protocolo}):`,
            error,
          );
          resultado.erros++;
        }
      }

      this.logger.log(
        `Padronização concluída: ${resultado.vendasAtualizadas} vendas atualizadas, ${resultado.erros} erros`,
      );

      return resultado;
    } catch (error) {
      this.logger.error('Erro geral na padronização de nomes:', error);
      throw error;
    }
  }

  /**
   * Padroniza um nome: maiúsculas e normaliza espaços
   * Ex: "Abnil C. L  Neto" -> "ABNIL C. L NETO"
   */
  private padronizarNome(nome: string): string {
    if (!nome) return nome;

    return nome
      .toUpperCase()
      .trim()
      .replace(/\s+/g, ' ') // Normaliza múltiplos espaços para um único espaço
      .replace(/\s+\./g, '.') // Remove espaços antes de ponto
      .replace(/\.\s+/g, '. ') // Garante espaço após ponto (mas preserva . seguido de espaço)
      .trim();
  }
}

