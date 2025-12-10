import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { Request } from "express";
import { Reflector } from "@nestjs/core";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, getMetadataArgsStorage, DataSource } from "typeorm";
import { AuditoriaService } from "../services/auditoria.service";
import { AuditAction } from "../enums/auditoria.enum";
import { Configuracao } from "../../modules/configuracao/entities/configuracao.entity";

export const AUDIT_ACTION_KEY = "audit_action";
export const AUDIT_ENTITY_TYPE_KEY = "audit_entity_type";

/**
 * Decorator para marcar endpoints que devem gerar logs de auditoria
 */
export const AuditLog = (action: AuditAction, entityType?: string) => {
  return (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) => {
    Reflect.defineMetadata(AUDIT_ACTION_KEY, action, descriptor.value);
    if (entityType) {
      Reflect.defineMetadata(
        AUDIT_ENTITY_TYPE_KEY,
        entityType,
        descriptor.value,
      );
    }
    return descriptor;
  };
};

@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditoriaInterceptor.name);
  private entityTableCache: Map<string, string> = new Map();
  private lastCacheUpdate = 0;
  private readonly CACHE_TTL = 300000; // 5 minutos

  constructor(
    private readonly auditoriaService: AuditoriaService,
    private readonly reflector: Reflector,
    @InjectRepository(Configuracao)
    private readonly configuracaoRepository: Repository<Configuracao>,
    private readonly dataSource: DataSource,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    const className = context.getClass().name;

    // ✅ CORREÇÃO: Evitar auditoria em endpoints de logout para prevenir loops
    if (request.url === '/api/auth/logout' || request.url.endsWith('/logout')) {
      return next.handle(); // Pular auditoria para logout
    }
    // ❌ Pular auditoria para endpoints de laudos sem decorator (upload, list, download)
    if (request.url.includes('/laudos')) {
      return next.handle();
    }

    const startTime = Date.now();
    const userId = (request as any).user?.id;

    // Capturar dados anteriores para UPDATE/DELETE antes da operação
    let previousDataPromise: Promise<any> | null = null;
    const method = request.method;
    const entityId = request.params?.id;

    if ((method === 'PUT' || method === 'PATCH' || method === 'DELETE') && entityId && userId) {
      const { action, entityType } = this.determineAuditAction(request, handler, className, null);
      previousDataPromise = this.capturePreviousData(entityType, entityId);
    }

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const { shouldAudit, action, entityType } = this.determineAuditAction(
            request,
            handler,
            className,
            response,
          );

          // Verificar se deve auditar baseado nas configurações do sistema
          const shouldAuditConfig = await this.shouldAuditAction(action, entityType);

          if (shouldAudit && shouldAuditConfig && userId) {
            const entityId = this.extractEntityId(request, response);
            
            // Capturar dados anteriores se necessário
            let previousData = null;
            if (previousDataPromise) {
              try {
                previousData = await previousDataPromise;
              } catch (error) {
                this.logger.warn('Erro ao capturar dados anteriores:', error.message);
              }
            }

            const { newData } = await this.extractOperationDataAsync(action, request, response, entityType, entityId || '');

            await this.auditoriaService.createLog({
              usuarioId: userId,
              acao: action,
              entidade: entityType,
              entidadeId: entityId,
              dadosAnteriores: previousData,
              dadosNovos: newData,
              enderecoIp: this.extractIpAddress(request),
              descricao: this.generateDescription(action, entityType, (request as any).user?.nome),
            });
          }
        } catch (error) {
          this.logger.error("Erro ao criar log de auditoria:", error);
        }
      }),
      catchError(async (error) => {
        try {
          const { shouldAudit, action, entityType } = this.determineAuditAction(
            request,
            handler,
            className,
            null,
          );

          // Verificar se deve auditar baseado nas configurações do sistema
          const shouldAuditConfig = await this.shouldAuditAction(action, entityType);

          if (shouldAudit && shouldAuditConfig && userId) {
            await this.auditoriaService.createLog({
              usuarioId: userId,
              acao: action,
              entidade: entityType,
              enderecoIp: this.extractIpAddress(request),
              descricao: `Erro: ${error.message || "Erro desconhecido"}`,
              dadosNovos: { error: error.message },
            });
          }
        } catch (auditError) {
          this.logger.error("Erro ao criar log de auditoria de erro:", auditError);
        }

        throw error;
      }),
    );
  }

  /**
   * Determina automaticamente se deve auditar e qual ação/entity
   */
  private determineAuditAction(
    request: Request,
    handler: any,
    className: string,
    response: any,
  ): { shouldAudit: boolean; action: AuditAction; entityType: string } {
    // Primeiro, verificar se há decorator específico
    const auditAction = this.reflector.get<AuditAction>(
      AUDIT_ACTION_KEY,
      handler,
    );
    const auditEntityType = this.reflector.get<string>(
      AUDIT_ENTITY_TYPE_KEY,
      handler,
    );

    if (auditAction) {
      return {
        shouldAudit: true,
        action: auditAction,
        entityType: auditEntityType || this.extractEntityTypeFromClass(className),
      };
    }

    // Determinar automaticamente baseado no método HTTP e caminho
    const method = request.method;
    const path = request.url.split("?")[0];

    // Operações sensíveis sempre auditadas
    if (this.isSensitiveOperation(path, method)) {
      return {
        shouldAudit: true,
        action: this.mapHttpMethodToAuditAction(method, path),
        entityType: this.extractEntityTypeFromPath(path),
      };
    }

    return {
      shouldAudit: false,
      action: AuditAction.READ,
      entityType: "",
    };
  }

  /**
   * Verifica se uma ação deve ser auditada baseado nas configurações do sistema
   */
  private async shouldAuditAction(action: AuditAction, entityType?: string): Promise<boolean> {
    try {
      // Buscar a configuração do sistema (assumindo que existe apenas uma)
      const config = await this.configuracaoRepository.findOne({
        where: {}
      });

      // ✅ DEBUG: Log da configuração encontrada

      if (!config) {
        // Se não há configuração, auditar por segurança (apenas operações críticas)
        return action === AuditAction.LOGIN || action === AuditAction.LOGOUT ||
               action === AuditAction.CHANGE_PASSWORD || action === AuditAction.LOGIN_FAILED;
      }

      // Verificar configurações específicas baseadas na ação
      let shouldAudit = false;
      switch (action) {
        case AuditAction.LOGIN:
        case AuditAction.LOGOUT:
        case AuditAction.LOGIN_FAILED:
          shouldAudit = config.auditarLoginLogOff;
          break;
        case AuditAction.CREATE:
          shouldAudit = config.auditarCriacao;
          break;
        case AuditAction.UPDATE:
          shouldAudit = config.auditarAlteracao;
          break;
        case AuditAction.DELETE:
          shouldAudit = config.auditarExclusao;
          break;
        case AuditAction.READ:
          shouldAudit = config.auditarConsultas;
          break;
        case AuditAction.CHANGE_PASSWORD:
          shouldAudit = config.auditarSenhaAlterada;
          break;
        default:
          shouldAudit = config.auditarConsultas;
      }

      return shouldAudit;

    } catch (error) {
      this.logger.error('Erro ao verificar configuração de auditoria:', error);
      // Em caso de erro, não auditar por padrão (mais seguro)
      return false;
    }
  }

  /**
   * Descobre automaticamente entidades via TypeORM Metadata
   */
  private getAllEntityTables(): Map<string, string> {
    const now = Date.now();
    
    // Cache com TTL para performance
    if (this.entityTableCache.size > 0 && (now - this.lastCacheUpdate) < this.CACHE_TTL) {
      return this.entityTableCache;
    }

    try {
      const metadataArgsStorage = getMetadataArgsStorage();
      const entityMap = new Map<string, string>();

      // Descobrir todas as entidades registradas
      for (const table of metadataArgsStorage.tables) {
        if (table.target && table.name) {
          const entityName = typeof table.target === 'function' 
            ? table.target.name.toLowerCase()
            : String(table.target).toLowerCase();
          
          const tableName = table.name;
          
          // Mapear variações comuns do nome
          this.addEntityVariations(entityMap, entityName, tableName);
          this.addEntityVariations(entityMap, tableName, tableName);
        }
      }

      this.entityTableCache = entityMap;
      this.lastCacheUpdate = now;
      
      
    } catch (error) {
      this.logger.warn('Erro ao descobrir entidades via TypeORM, usando cache existente', error.message);
    }

    return this.entityTableCache;
  }

  /**
   * Adiciona variações comuns de nomes de entidades
   */
  private addEntityVariations(map: Map<string, string>, entityName: string, tableName: string): void {
    const variations = [
      entityName,
      entityName.replace('entity', ''),
      this.toPlural(entityName),
      this.toSingular(entityName),
      this.toKebabCase(entityName),
      this.toCamelCase(entityName),
      this.toSnakeCase(entityName),
    ];

    variations.forEach(variation => {
      if (variation && variation.length > 0) {
        map.set(variation.toLowerCase(), tableName);
      }
    });

    // Adicionar mapeamentos específicos para corrigir problemas conhecidos
    if (tableName === 'usuarios') {
      map.set('users', 'usuarios');
      map.set('user', 'usuarios');
    } 
  }

  /**
   * Verifica se é uma operação sensível
   */
  private isSensitiveOperation(path: string, method: string): boolean {
    // Sempre auditar operações de escrita
    if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      return true;
    }

    // Verificar se path corresponde a alguma entidade conhecida
    const entityType = this.extractEntityTypeFromPath(path);
    const entityMap = this.getAllEntityTables();
    
    // Se encontrou uma entidade conhecida, é sensível
    return entityMap.has(entityType.toLowerCase()) || entityType !== "unknown";
  }

  /**
   * Mapeia método HTTP para ação de auditoria
   */
  private mapHttpMethodToAuditAction(method: string, path: string): AuditAction {
    // Operações especiais
    if (path.includes("/change-password")) {
      return AuditAction.CHANGE_PASSWORD;
    }

    if (path.includes("/login")) {
      return AuditAction.LOGIN;
    }

    if (path.includes("/logout")) {
      return AuditAction.LOGOUT;
    }

    // Mapeamento padrão
    switch (method) {
      case "POST":
        return AuditAction.CREATE;
      case "PUT":
      case "PATCH":
        return AuditAction.UPDATE;
      case "DELETE":
        return AuditAction.DELETE;
      case "GET":
      default:
        return AuditAction.READ;
    }
  }

  /**
   * Extrai tipo de entidade do caminho da URL - TOTALMENTE ESCALÁVEL
   */
  private extractEntityTypeFromPath(path: string): string {
    const cleanPath = path.split("?")[0].replace(/^\/api\//, "");
    const segments = cleanPath.split("/").filter(Boolean);

    if (segments.length === 0) return "unknown";

    const pathSegment = segments[0].toLowerCase();
    
    // ✅ ESCALÁVEL: Usa descoberta automática
    const entityMap = this.getAllEntityTables();
    
    // Tentar encontrar correspondência exata primeiro
    if (entityMap.has(pathSegment)) {
      return entityMap.get(pathSegment)!;
    }

    // Tentar correspondências aproximadas
    for (const [key, tableName] of entityMap.entries()) {
      if (key.includes(pathSegment) || pathSegment.includes(key)) {
        return tableName;
      }
    }

    // Fallback: normalizar o nome do path
    return pathSegment.replace(/-/g, "_");
  }

  /**
   * Extrai tipo de entidade do nome da classe
   */
  private extractEntityTypeFromClass(className: string): string {
    return className.replace("Controller", "").toLowerCase();
  }

  /**
   * Extrai o ID da entidade
   */
  private extractEntityId(request: Request, response: any): string | undefined {
    // Primeiro, verificar parâmetros da URL
    if (request.params?.id) {
      return request.params.id;
    }

    // Depois verificar na resposta (para operações CREATE)
    if (response?.id) {
      return response.id;
    }

    // Verificar response aninhado
    if (response?.data?.id) {
      return response.data.id;
    }

    // Operações em massa: buscar arrays de IDs no body (genérico)
    const body: any = request.body;
    if (body && typeof body === 'object') {
      // Priorizar chaves comuns
      const commonKeys = ['ids', 'vendaIds', 'itemIds', 'entityIds'];
      for (const key of commonKeys) {
        if (Array.isArray(body[key]) && body[key].length > 0) {
          return body[key].join(',');
        }
      }
      // Fallback: primeira propriedade array de strings/UUIDs
      for (const value of Object.values(body)) {
        if (Array.isArray(value) && value.length > 0 && value.every(v => typeof v === 'string')) {
          return value.join(',');
        }
      }
      // Fallback único ID
      if (typeof body.id === 'string') {
        return body.id;
      }
      const singleKey = Object.keys(body).find(k => k.toLowerCase().endsWith('id') && typeof body[k] === 'string');
      if (singleKey) {
        return body[singleKey];
      }
    }

    return undefined;
  }

  /**
   * Extrai dados da operação de forma assíncrona
   */
  private async extractOperationDataAsync(
    action: AuditAction,
    request: Request,
    response: any,
    entityType: string,
    entityId: string,
  ): Promise<{ newData?: any }> {
    switch (action) {
      case AuditAction.CREATE:
        // Para CREATE, primeiro tentar response, depois buscar do banco se tiver ID
        if (response && typeof response === 'object') {
          // Se response tem ID, buscar objeto completo do banco
          if (response.id) {
            try {
              const completeObject = await this.fetchCompleteObject(entityType, response.id);
              if (completeObject) {
                return { newData: this.sanitizeData(completeObject) };
              }
            } catch (error) {
              this.logger.warn('Erro ao buscar objeto completo após CREATE:', error.message);
            }
          }
          return { newData: this.sanitizeData(response) };
        }
        return { newData: this.sanitizeData(request.body) };

      case AuditAction.UPDATE:
        // Atualização em massa: focar apenas nos campos alterados
        const bodyUpdate: any = request.body || {};
        const idsFromBody = this.getIdsFromBody(bodyUpdate);
        const isEntityIdList = typeof entityId === 'string' && entityId.includes(',');

        if (idsFromBody || isEntityIdList) {
          const ids = idsFromBody || entityId.split(',').filter(Boolean);
          const changes = this.sanitizeData(this.stripIdsDeep(bodyUpdate));
          return { newData: { ids, changes } };
        }

        // Atualização simples: tentar buscar objeto completo
        if (entityId) {
          try {
            const completeObject = await this.fetchCompleteObject(entityType, entityId);
            if (completeObject) {
              return { newData: this.sanitizeData(completeObject) };
            }
          } catch (error) {
            this.logger.warn('Erro ao buscar objeto completo após UPDATE:', error.message);
          }
        }
        // Fallback para response ou request.body
        if (response && typeof response === 'object') {
          return { newData: this.sanitizeData(response) };
        }
        return { newData: this.sanitizeData(request.body) };

      case AuditAction.DELETE:
        // Para DELETE, dados anteriores já foram capturados, response pode ter confirmação
        if (response && typeof response === 'object') {
          return { newData: this.sanitizeData(response) };
        }
        return { newData: { deleted: true, entityId } };

      default:
        return {};
    }
  }

  /**
   * Busca objeto completo do banco de dados
   */
  private async fetchCompleteObject(entityType: string, entityId: string): Promise<any> {
    try {
      // Mapear nome da entidade para classe TypeORM usando cache
      const entityTableMap = this.getAllEntityTables();
      
      // Encontrar a entidade baseada no entityType
      let targetEntity: string | null = null;
      for (const [entityName, variations] of entityTableMap.entries()) {
        if (variations.includes(entityType)) {
          targetEntity = entityName;
          break;
        }
      }

      if (!targetEntity) {
        this.logger.warn(`Entidade ${entityType} não mapeada no sistema`);
        return null;
      }

      // Obter repositório usando metadata do TypeORM
      const metadata = this.dataSource.entityMetadatas.find(meta => 
        meta.tableName === targetEntity || 
        meta.name.toLowerCase() === targetEntity!.toLowerCase()
      );

      if (!metadata) {
        this.logger.warn(`Metadata não encontrada para entidade ${targetEntity}`);
        return null;
      }

      const repository = this.dataSource.getRepository(metadata.target);
      
      // Buscar a entidade completa
      const completeObject = await repository.findOne({
        where: { id: entityId }
      });

      return completeObject;

    } catch (error) {
      this.logger.warn(`Erro ao buscar objeto completo para ${entityType}:${entityId}`, error.message);
      return null;
    }
  }

  /**
   * Extrai dados da operação
   */
  private extractOperationData(
    action: AuditAction,
    request: Request,
    response: any,
  ): { newData?: any } {
    switch (action) {
      case AuditAction.CREATE:
        // Para CREATE, preferir response (objeto completo com ID) se disponível
        if (response && typeof response === 'object') {
          return {
            newData: this.sanitizeData(response),
          };
        }
        // Fallback para request.body
        return {
          newData: this.sanitizeData(request.body),
        };

      case AuditAction.UPDATE:
        // Para UPDATE, preferir response (objeto completo) se disponível
        if (response && typeof response === 'object') {
          return {
            newData: this.sanitizeData(response),
          };
        }
        // Fallback para request.body (dados parciais)
        return {
          newData: this.sanitizeData(request.body),
        };

      case AuditAction.DELETE:
        // Para DELETE, response pode conter confirmação da exclusão
        if (response && typeof response === 'object') {
          return {
            newData: this.sanitizeData(response),
          };
        }
        return {};

      default:
        return {};
    }
  }

  /**
   * Captura dados anteriores para operações UPDATE/DELETE
   
  private async capturePreviousData(entityType: string, entityId: string): Promise<any> {
    try {
      // Log inicial de captura de dados anteriores
      // Mapear nome da entidade para classe TypeORM usando cache
      const entityTableMap = this.getAllEntityTables();
      // Log das chaves do mapeamento de entidade
      
      // Encontrar a entidade baseada no entityType
      let targetEntity: string | null = null;
      for (const [entityName, variations] of entityTableMap.entries()) {
        if (variations.includes(entityType)) {
          targetEntity = entityName;
          break;
        }
      }

      if (!targetEntity) {
        this.logger.warn(`Entidade ${entityType} não mapeada no sistema`);
        return null;
      }

      // Obter repositório usando metadata do TypeORM
      const metadata = this.dataSource.entityMetadatas.find(meta => 
        meta.tableName === targetEntity || 
        meta.name.toLowerCase() === targetEntity!.toLowerCase()
      );

      if (!metadata) {
        this.logger.warn(`Metadata não encontrada para entidade ${targetEntity}`);
        return null;
      }

      const repository = this.dataSource.getRepository(metadata.target);
      
      // Buscar a entidade atual pelos seus dados
      const currentData = await repository.findOne({
        where: { id: entityId }
      });

      if (!currentData) {
        this.logger.warn(`Entidade ${entityType} com ID ${entityId} não encontrada para capturar dados anteriores`);
        return null;
      }

      // Sanitizar dados antes de salvar (remover campos sensíveis)
      return this.sanitizeData(currentData);

    } catch (error) {
      this.logger.warn(`Erro ao capturar dados anteriores para ${entityType}:${entityId}`, error.message);
      
      // Fallback - retornar ao menos informações básicas
      return {
        _error: 'Falha ao capturar dados anteriores',
        entityType,
        entityId,
        timestamp: new Date().toISOString(),
        errorMessage: error.message
      };
    }
  }
  */

  private async capturePreviousData(entityType: string, entityId: string): Promise<any> {
  try {

    // 1) Encontrar metadata pela tableName (entityType)
    const metadata = this.dataSource.entityMetadatas.find(
      meta => meta.tableName === entityType
    );
    if (!metadata) {
      this.logger.warn(`Metadata não encontrada para tableName="${entityType}"`);
      return null;
    }

    // 2) Obter repositório da entidade
    const repository = this.dataSource.getRepository(metadata.target);

    // 3) Buscar registro ANTES da operação
    const before = await repository.findOne({ where: { id: entityId } });

    if (!before) {
      this.logger.warn(`Nenhum dado anterior encontrado para ${entityType}:${entityId}`);
      return null;
    }

    // 4) Sanitizar e retornar
    return this.sanitizeData(before);

  } catch (error) {
    this.logger.warn(
      `Erro ao capturar dados anteriores para ${entityType}:${entityId}`,
      error.message
    );
    // Fallback – retornar ao menos informações básicas
    return {
      _error: 'Falha ao capturar dados anteriores',
      entityType,
      entityId,
      timestamp: new Date().toISOString(),
      errorMessage: error.message
    };
  }
}

  /**
   * Remove dados sensíveis
   */
  private sanitizeData(data: any): any {
    if (!data) return data;

    const sanitized = { ...data };

    // Remover campos sensíveis
    const sensitiveFields = ["password", "senha", "token", "secret"];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    });

    return sanitized;
  }

  /**
   * Extrai endereço IP
   */
  private extractIpAddress(request: Request): string {
    const forwarded = request.headers["x-forwarded-for"] as string;
    const realIp = request.headers["x-real-ip"] as string;
    const remoteAddress = (request as any).connection?.remoteAddress ||
                         (request as any).socket?.remoteAddress ||
                         (request as any).ip;

    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }

    return realIp || remoteAddress || "unknown";
  }

  /**
   * Gera descrição amigável
   */
  private generateDescription(action: AuditAction, entityName: string, userName?: string): string {
    const actionText = {
      [AuditAction.CREATE]: "criou",
      [AuditAction.UPDATE]: "atualizou",
      [AuditAction.DELETE]: "excluiu",
      [AuditAction.READ]: "consultou",
      [AuditAction.LOGIN]: "fez login",
      [AuditAction.LOGOUT]: "fez logout",
      [AuditAction.LOGIN_FAILED]: "tentou fazer login",
      [AuditAction.CHANGE_PASSWORD]: "alterou senha",
    };

    const user = userName || "Usuário";
    const entity = this.getEntityFriendlyName(entityName);

    return `${user} ${actionText[action]} ${entity}`;
  }

  /**
   * Obtém nome amigável da entidade - ESCALÁVEL
   */
  private getEntityFriendlyName(entityType: string): string {
    // ✅ ESCALÁVEL: Gerar nome amigável automaticamente
    return entityType
      .replace(/_/g, " ")
      .replace(/-/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  // Utilitários para transformação de strings
  private toPlural(str: string): string {
    if (str.endsWith('s')) return str;
    if (str.endsWith('ao')) return str.slice(0, -2) + 'oes';
    if (str.endsWith('r') || str.endsWith('z')) return str + 'es';
    return str + 's';
  }

  private toSingular(str: string): string {
    if (str.endsWith('oes')) return str.slice(0, -3) + 'ao';
    if (str.endsWith('es')) return str.slice(0, -2);
    if (str.endsWith('s') && !str.endsWith('us')) return str.slice(0, -1);
    return str;
  }

  private toKebabCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  }

  private toCamelCase(str: string): string {
    return str.replace(/[-_](.)/g, (_, char) => char.toUpperCase());
  }

  private toSnakeCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  }

  /**
   * Extrai um array de IDs de um body de requisição (operações em massa)
   */
  private getIdsFromBody(body: any): string[] | null {
    if (!body || typeof body !== 'object') {
      return null;
    }
    const commonKeys = ['ids', 'vendaIds', 'itemIds', 'entityIds'];
    for (const key of commonKeys) {
      if (Array.isArray(body[key]) && body[key].length > 0) {
        return body[key].filter((v: any) => typeof v === 'string');
      }
    }
    for (const value of Object.values(body)) {
      if (Array.isArray(value) && value.length > 0 && value.every(v => typeof v === 'string')) {
        return value;
      }
    }
    return null;
  }

  /**
   * Remove campos de IDs do body para registrar apenas os dados alterados
   */
  private stripIdsDeep(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    // Clonar como objeto plano para garantir propriedades enumeráveis
    let clone: any;
    try {
      clone = JSON.parse(JSON.stringify(body));
    } catch {
      clone = { ...body };
    }

    const keysToRemove = Object.keys(clone).filter(
      k => k.toLowerCase() === 'ids' || k.toLowerCase().endsWith('ids'),
    );
    keysToRemove.forEach(k => delete clone[k]);

    // Limpar recursivamente estruturas aninhadas
    Object.keys(clone).forEach(k => {
      if (typeof clone[k] === 'object') {
        clone[k] = this.stripIdsDeep(clone[k]);
      }
    });

    return clone;
  }
}
