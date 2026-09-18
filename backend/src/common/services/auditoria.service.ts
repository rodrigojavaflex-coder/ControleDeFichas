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

  /** Mínimo para varrer JSONB (alinha ao índice GIN/trgm da migration). */
  private static readonly SEARCH_JSON_MIN_LENGTH = 3;

  /**
   * Mesmos caracteres da migration `1750590000000-auditoria-search-trgm`.
   * Manter as duas listas do mesmo tamanho.
   */
  private static readonly PG_ACCENT_FROM =
    'áàâãäéèêëíìîïóòôõöúùûüçñý';
  private static readonly PG_ACCENT_TO = 'aaaaaeeeeiiiiooooouuuucny';

  constructor(
    @InjectRepository(Auditoria)
    private readonly auditLogRepository: Repository<Auditoria>,
  ) {}

  /**
   * Gera descrição contextual baseada na ação e tipo de entidade
   */
  private generateEntityDescription(
    action: AuditAction,
    entityType?: string,
    entityInstance?: any,
  ): string | null {
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
  private getEntityFriendlyName(
    tableName?: string,
    entityInstance?: any,
  ): string {
    // Primeiro tentar obter da instância da entidade
    if (entityInstance && typeof entityInstance === 'object') {
      try {
        const entityClass = entityInstance.constructor;
        if (entityClass && typeof entityClass.nomeAmigavel === 'string') {
          return entityClass.nomeAmigavel;
        }

        // Tentar obter o nome da tabela via TypeORM metadata
        const metadata = getMetadataArgsStorage();
        const tableMetadata = metadata.tables.find(
          (table) => table.target === entityClass,
        );
        if (tableMetadata && tableMetadata.name) {
          const tableNameFromMetadata = tableMetadata.name;

          // Tentar carregar a classe da entidade dinamicamente
          const entityClassFromTable = this.getEntityClassFromTableName(
            tableNameFromMetadata,
          );
          if (
            entityClassFromTable &&
            typeof entityClassFromTable.nomeAmigavel === 'string'
          ) {
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
        this.logger.warn(
          `Erro ao obter nome amigável para entidade ${tableName}:`,
          error,
        );
      }
    }

    // Fallback para casos especiais e nomes não mapeados
    const fallbackNames: Record<string, string> = {
      Permissões: 'permissões',
      Senha: 'senha',
      Tema: 'tema',
      ContagemFichas: 'contagem de fichas',
      FichasRecentes: 'fichas recentes',
      Login: 'login',
      Logout: 'logout',
      Token: 'token',
      Autenticação: 'autenticação',
      Perfil: 'perfil',
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
        if (
          table.name === tableName &&
          table.target &&
          typeof table.target === 'function'
        ) {
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

      return null;
    } catch (error) {
      this.logger.warn(
        `Erro ao obter classe da entidade para tabela ${tableName}:`,
        error,
      );
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
  private getAllRegisteredEntities(): Array<{
    tableName: string;
    entityClass: any;
    friendlyName?: string;
  }> {
    try {
      const metadataStorage = getMetadataArgsStorage();
      const entities: Array<{
        tableName: string;
        entityClass: any;
        friendlyName?: string;
      }> = [];

      for (const table of metadataStorage.tables) {
        if (table.target && typeof table.target === 'function') {
          const entityClass = table.target;
          const tableName = table.name || 'unknown';
          const friendlyName =
            typeof (entityClass as any).nomeAmigavel === 'string'
              ? (entityClass as any).nomeAmigavel
              : undefined;

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
        this.generateEntityDescription(
          data.acao,
          data.entidade,
          data.entityInstance,
        ) ||
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

    // Listagem sem JSONB (TOAST). Detalhe carrega GET /auditoria/:id.
    const queryBuilder = this.auditLogRepository
      .createQueryBuilder('audit_log')
      .leftJoin('audit_log.usuario', 'usuario')
      .select([
        'audit_log.id',
        'audit_log.acao',
        'audit_log.descricao',
        'audit_log.entidade',
        'audit_log.entidadeId',
        'audit_log.enderecoIp',
        'audit_log.criadoEm',
        'audit_log.atualizadoEm',
        'usuario.id',
        'usuario.nome',
        'usuario.email',
      ])
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
      const enderecoIp = this.normalizeSearchTerm(findDto.enderecoIp);
      if (enderecoIp) {
        queryBuilder.andWhere(
          `${this.unaccentSql(`COALESCE(audit_log.enderecoIp, '')`)} LIKE :enderecoIp`,
          { enderecoIp: `%${enderecoIp}%` },
        );
      }
    }

    if (findDto.descricao) {
      const descricao = this.normalizeSearchTerm(findDto.descricao);
      if (descricao) {
        queryBuilder.andWhere(
          `${this.unaccentSql(`COALESCE(audit_log.descricao, '')`)} LIKE :descricao`,
          { descricao: `%${descricao}%` },
        );
      }
    }

    if (findDto.search) {
      const search = this.normalizeSearchTerm(String(findDto.search));
      if (search) {
        const includeJson =
          search.length >= AuditoriaService.SEARCH_JSON_MIN_LENGTH;
        queryBuilder.andWhere(
          `audit_log.id IN (${this.buildSearchUnionSql(includeJson)})`,
          { search: `%${search}%` },
        );
      }
    }

    const [items, total] = await Promise.all([
      queryBuilder.clone().skip(skip).take(limit).getMany(),
      queryBuilder.clone().getCount(),
    ]);

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
    return this.auditLogRepository
      .createQueryBuilder('audit_log')
      .leftJoin('audit_log.usuario', 'usuario')
      .addSelect(['usuario.id', 'usuario.nome', 'usuario.email'])
      .where('audit_log.id = :id', { id })
      .getOne();
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

  /**
   * UNION ALL por coluna para o planner usar GIN/trgm em cada braço
   * (OR único costuma cair em seq scan).
   */
  private buildSearchUnionSql(includeJson: boolean): string {
    const match = (expr: string): string =>
      `${this.unaccentSql(expr)} LIKE :search`;

    const arms = [
      `SELECT a.id FROM auditoria a WHERE ${match(`COALESCE(a.descricao, '')`)}`,
      `SELECT a.id FROM auditoria a WHERE ${match(`COALESCE(a."enderecoIp", '')`)}`,
      `SELECT a.id FROM auditoria a WHERE ${match(`COALESCE(a."entidadeId", '')`)}`,
      `SELECT a.id FROM auditoria a INNER JOIN usuarios u ON u.id = a."usuarioId" WHERE ${match(`COALESCE(u.nome, '')`)}`,
    ];

    if (includeJson) {
      arms.push(
        `SELECT a.id FROM auditoria a WHERE ${match(`COALESCE(CAST(a."dadosAnteriores" AS text), '')`)}`,
        `SELECT a.id FROM auditoria a WHERE ${match(`COALESCE(CAST(a."dadosNovos" AS text), '')`)}`,
      );
    }

    return arms.join(' UNION ALL ');
  }

  /**
   * Expressão SQL sem acento, alinhada aos índices GIN da migration.
   */
  private unaccentSql(sqlExpr: string): string {
    return `translate(lower(${sqlExpr}), '${AuditoriaService.PG_ACCENT_FROM}', '${AuditoriaService.PG_ACCENT_TO}')`;
  }

  /**
   * Normaliza o termo: trim, sem acento, minúsculas e sem curingas LIKE.
   */
  private normalizeSearchTerm(value: string): string {
    return value
      .trim()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[%_]/g, '');
  }

  async findByEntity(
    entidade: string,
    entidadeId: string,
  ): Promise<Auditoria[]> {
    return this.auditLogRepository.find({
      where: {
        entidade,
        entidadeId,
      },
      relations: ['usuario'],
      order: {
        criadoEm: 'DESC',
      },
    });
  }
}
