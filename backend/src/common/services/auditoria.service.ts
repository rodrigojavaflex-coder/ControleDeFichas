import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, getMetadataArgsStorage } from 'typeorm';
import {
  AuditAction,
  AUDIT_ACTION_DESCRIPTIONS,
} from '../enums/auditoria.enum';
import { Auditoria } from '../../modules/auditoria/entities/auditoria.entity';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../dto/paginated-response.dto';

export interface CreateAuditLogDto {
  acao: AuditAction;
  usuarioId?: string;
  entidade?: string;
  entidadeId?: string;
  dadosAnteriores?: any;
  dadosNovos?: any;
  enderecoIp?: string;
  descricao?: string;
  request?: any;
  entityInstance?: any; // Instância da entidade para obter nome amigável
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(
    @InjectRepository(Auditoria)
    private readonly auditLogRepository: Repository<Auditoria>,
  ) {}

  /**
   * Gera descrição contextual baseada na ação e tipo de entidade
   */
  private generateEntityDescription(action: AuditAction, entityType?: string, entityInstance?: any): string | null {
    if (!entityType && !entityInstance) {
      return null;
    }

    // Tentar obter o nome amigável da entidade através da classe ou instância
    const entityName = this.getEntityFriendlyName(entityType, entityInstance);

    switch (action) {
      case AuditAction.CREATE:
        return `Registro foi criado no cadastro de ${entityName}`;
      
      case AuditAction.UPDATE:
        return `Registro foi alterado no cadastro de ${entityName}`;
      
      case AuditAction.DELETE:
        return `Registro foi removido do cadastro de ${entityName}`;
      
      case AuditAction.READ:
        return `Registro foi consultado no cadastro de ${entityName}`;
      
      default:
        return null; // Para outras ações, usar as descrições padrão
    }
  }

  /**
   * Obtém o nome amigável da entidade baseado no nome da tabela ou instância
   */
  private getEntityFriendlyName(tableName?: string, entityInstance?: any): string {
    // Primeiro tentar obter da instância da entidade
    if (entityInstance && typeof entityInstance === 'object') {
      try {
        const entityClass = entityInstance.constructor;
        if (entityClass && typeof entityClass.nomeAmigavel === 'string') {
          return entityClass.nomeAmigavel;
        }

        // Tentar obter o nome da tabela via TypeORM metadata
        const metadata = getMetadataArgsStorage();
        const tableMetadata = metadata.tables.find(table => table.target === entityClass);
        if (tableMetadata && tableMetadata.name) {
          const tableNameFromMetadata = tableMetadata.name as string;
          
          // Tentar carregar a classe da entidade dinamicamente
          const entityClassFromTable = this.getEntityClassFromTableName(tableNameFromMetadata);
          if (entityClassFromTable && typeof entityClassFromTable.nomeAmigavel === 'string') {
            return entityClassFromTable.nomeAmigavel;
          }
        }
      } catch (error) {
        this.logger.warn(`Erro ao obter nome amigável da instância:`, error);
      }
    }

    // Fallback para nome da tabela passado como parâmetro
    if (tableName) {
      try {
        const entityClass = this.getEntityClassFromTableName(tableName);
        if (entityClass && typeof entityClass.nomeAmigavel === 'string') {
          return entityClass.nomeAmigavel;
        }
      } catch (error) {
        this.logger.warn(`Erro ao obter nome amigável para entidade ${tableName}:`, error);
      }
    }

    // Fallback para casos especiais e nomes não mapeados
    const fallbackNames: Record<string, string> = {
      'Permissões': 'permissões',
      'Senha': 'senha',
      'Tema': 'tema',
      'ContagemFichas': 'contagem de fichas',
      'FichasRecentes': 'fichas recentes',
      'Login': 'login',
      'Logout': 'logout',
      'Token': 'token',
      'Autenticação': 'autenticação',
      'Perfil': 'perfil',
    };

    return fallbackNames[tableName || ''] || tableName || 'entidade';
  }

  /**
   * Obtém a classe da entidade baseado no nome da tabela
   * @deprecated Este método não é escalável. Use getEntityClassFromMetadata em vez disso.
   */
  private getEntityClassFromTableName(tableName: string): any {
    // Fallback para compatibilidade - será removido em versões futuras
    return this.getEntityClassFromMetadata(tableName);
  }

  /**
   * Obtém a classe da entidade usando metadados TypeORM (mais escalável)
   */
  private getEntityClassFromMetadata(tableName: string): any {
    try {
      const metadataStorage = getMetadataArgsStorage();

      // Primeiro, tentar encontrar entidade com nome de tabela exato
      for (const table of metadataStorage.tables) {
        if (table.name === tableName && table.target && typeof table.target === 'function') {
          return table.target;
        }
      }

      // Se não encontrou, tentar procurar por entidades que podem ter nomes de tabela derivados
      for (const table of metadataStorage.tables) {
        if (table.target && typeof table.target === 'function') {
          const entityName = table.target.name;

          // Converter camelCase para snake_case
          const derivedTableName = entityName
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            .toLowerCase();

          if (derivedTableName === tableName) {
            return table.target;
          }

          // Também tentar pluralização simples (User -> users, etc.)
          const pluralizedTableName = this.pluralize(entityName)
            .replace(/([a-z])([A-Z])/g, '$1_$2')
            .toLowerCase();

          if (pluralizedTableName === tableName) {
            return table.target;
          }
        }
      }

      this.logger.debug(`Entidade não encontrada para tabela: ${tableName}`);
      return null;
    } catch (error) {
      this.logger.warn(`Erro ao obter classe da entidade para tabela ${tableName}:`, error);
      return null;
    }
  }

  /**
   * Pluraliza uma palavra de forma simples
   */
  private pluralize(word: string): string {
    if (!word) return word;

    // Regras básicas de pluralização em português
    if (word.endsWith('ao')) return word.slice(0, -2) + 'oes';
    if (word.endsWith('a')) return word + 's';
    if (word.endsWith('e')) return word + 's';
    if (word.endsWith('o')) return word + 's';
    if (word.endsWith('u')) return word + 's';
    if (word.endsWith('l')) return word + 'is';
    if (word.endsWith('r')) return word + 'es';
    if (word.endsWith('z')) return word.slice(0, -1) + 'ces';

    return word + 's'; // Fallback
  }

  /**
   * Lista todas as entidades registradas no TypeORM (para debug)
   */
  private getAllRegisteredEntities(): Array<{ tableName: string; entityClass: any; friendlyName?: string }> {
    try {
      const metadataStorage = getMetadataArgsStorage();
      const entities: Array<{ tableName: string; entityClass: any; friendlyName?: string }> = [];

      for (const table of metadataStorage.tables) {
        if (table.target && typeof table.target === 'function') {
          const entityClass = table.target;
          const tableName = table.name || 'unknown';
          const friendlyName = typeof (entityClass as any).nomeAmigavel === 'string' ? (entityClass as any).nomeAmigavel : undefined;

          entities.push({
            tableName,
            entityClass,
            friendlyName,
          });
        }
      }

      return entities;
    } catch (error) {
      this.logger.error('Erro ao listar entidades registradas:', error);
      return [];
    }
  }

  async createLog(data: CreateAuditLogDto): Promise<Auditoria> {
    try {
      const auditLog = new Auditoria();

      // Dados básicos
      auditLog.acao = data.acao;
      auditLog.entidade = data.entidade || null;
      auditLog.entidadeId = data.entidadeId || null;

      // Definir usuário se fornecido
      if (data.usuarioId) {
        auditLog.usuario = { id: data.usuarioId } as any;
      }

      // Descrição
      auditLog.descricao =
        data.descricao ||
        this.generateEntityDescription(data.acao, data.entidade, data.entityInstance) ||
        AUDIT_ACTION_DESCRIPTIONS[data.acao] ||
        'Ação não especificada';

      // Dados da operação
      auditLog.dadosAnteriores = data.dadosAnteriores;
      auditLog.dadosNovos = data.dadosNovos;

      // Dados da requisição HTTP
      if (data.request) {
        auditLog.enderecoIp = this.extractIpAddress(data.request);
      } else {
        auditLog.enderecoIp = data.enderecoIp || null;
      }

      return await this.auditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.error('Failed to create audit log:', error);
      throw error;
    }
  }

  async logCreate(
    acao: AuditAction,
    descricao: string,
    dadosNovos: any,
    usuarioId?: string,
    entidade?: string,
    entidadeId?: string,
  ): Promise<Auditoria> {
    return this.createLog({
      acao,
      descricao,
      dadosNovos,
      usuarioId,
      entidade,
      entidadeId,
    });
  }

  async logUpdate(
    acao: AuditAction,
    descricao: string,
    dadosAnteriores: any,
    dadosNovos: any,
    usuarioId?: string,
    entidade?: string,
    entidadeId?: string,
  ): Promise<Auditoria> {
    return this.createLog({
      acao,
      descricao,
      dadosAnteriores,
      dadosNovos,
      usuarioId,
      entidade,
      entidadeId,
    });
  }

  async logDelete(
    acao: AuditAction,
    descricao: string,
    dadosDeletados: any,
    usuarioId?: string,
    entidade?: string,
    entidadeId?: string,
  ): Promise<Auditoria> {
    return this.createLog({
      acao,
      descricao,
      dadosAnteriores: dadosDeletados,
      usuarioId,
      entidade,
      entidadeId,
    });
  }

  async findLogs(findDto: any): Promise<PaginatedResponseDto<Auditoria>> {
    const page = findDto.page || 1;
    const limit = Math.min(findDto.limit || 20, 100);
    const skip = (page - 1) * limit;

    // Construir query builder para filtros dinâmicos
    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit_log')
      .leftJoinAndSelect('audit_log.usuario', 'usuario')
      .orderBy('audit_log.criadoEm', 'DESC');

    // Aplicar filtros
    if (findDto.usuarioId) {
      queryBuilder.andWhere('audit_log.usuarioId = :usuarioId', {
        usuarioId: findDto.usuarioId,
      });
    }

    if (findDto.acao) {
      queryBuilder.andWhere('audit_log.acao = :acao', {
        acao: findDto.acao,
      });
    }

    if (findDto.entidade) {
      queryBuilder.andWhere('audit_log.entidade = :entidade', {
        entidade: findDto.entidade,
      });
    }

    if (findDto.entidadeId) {
      queryBuilder.andWhere('audit_log.entidadeId = :entidadeId', {
        entidadeId: findDto.entidadeId,
      });
    }

    if (findDto.startDate) {
      queryBuilder.andWhere('audit_log.criadoEm >= :startDate', {
        startDate: findDto.startDate,
      });
    }

    if (findDto.endDate) {
      queryBuilder.andWhere('audit_log.criadoEm <= :endDate', {
        endDate: findDto.endDate,
      });
    }

    if (findDto.enderecoIp) {
      queryBuilder.andWhere('audit_log.enderecoIp ILIKE :enderecoIp', {
        enderecoIp: `%${findDto.enderecoIp}%`,
      });
    }

    if (findDto.descricao) {
      queryBuilder.andWhere('audit_log.descricao ILIKE :descricao', {
        descricao: `%${findDto.descricao}%`,
      });
    }

    // Para compatibilidade com o parâmetro 'search' do frontend
    if (findDto.search) {
      queryBuilder.andWhere(
        '(audit_log.descricao ILIKE :search OR audit_log.enderecoIp ILIKE :search OR usuario.name ILIKE :search)',
        { search: `%${findDto.search}%` },
      );
    }

    // Aplicar paginação
    const [items, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const meta: PaginationMetaDto = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasPreviousPage: page > 1,
      hasNextPage: page < Math.ceil(total / limit),
    };

    return { data: items, meta };
  }

  async findLogById(id: string): Promise<Auditoria | null> {
    return this.auditLogRepository.findOne({
      where: { id },
      relations: ['usuario'],
    });
  }

  extractAuditMetadata(req: any): any {
    if (!req) return {};

    return {
      enderecoIp: this.extractIpAddress(req),
      agenteUsuario: req.get('User-Agent') || null,
      endpoint: req.originalUrl || req.url || null,
      httpMethod: req.method || null,
    };
  }

  private extractIpAddress(req: any): string | null {
    if (!req) return null;

    return (
      req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      null
    );
  }

  private getDescription(action: AuditAction): string {
    return AUDIT_ACTION_DESCRIPTIONS[action] || `Action: ${action}`;
  }
}
