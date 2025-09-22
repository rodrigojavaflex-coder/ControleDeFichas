import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditLevel, AUDIT_ACTION_DESCRIPTIONS } from '../enums/audit.enum';
import { AuditLog } from '../entities/audit-log.entity';
import { PaginatedResponseDto, PaginationMetaDto } from '../dto/paginated-response.dto';

export interface CreateAuditLogDto {
  action: AuditAction;
  userId?: string;
  entityType?: string;
  entityId?: string;
  oldData?: any;
  newData?: any;
  previousData?: any;
  level?: AuditLevel;
  success?: boolean;
  errorMessage?: string;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
  httpMethod?: string;
  httpStatus?: number;
  executionTime?: number;
  description?: string;
  metadata?: any;
  request?: any;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async createLog(data: CreateAuditLogDto): Promise<AuditLog> {
    try {
      const auditLog = new AuditLog();
      
      // Dados básicos
      auditLog.action = data.action;
      auditLog.userId = data.userId || null;
      auditLog.entityType = data.entityType || null;
      auditLog.entityId = data.entityId || null;
      auditLog.level = data.level || AuditLevel.INFO;
      auditLog.success = data.success ?? true;
      auditLog.errorMessage = data.errorMessage || null;
      
      // Descrição
      auditLog.description = data.description || AUDIT_ACTION_DESCRIPTIONS[data.action] || 'Ação não especificada';
      
      // Dados da operação
      auditLog.previousData = data.previousData || data.oldData;
      auditLog.newData = data.newData;
      auditLog.metadata = data.metadata;
      
      // Dados da requisição HTTP
      if (data.request) {
        auditLog.ipAddress = this.extractIpAddress(data.request);
        auditLog.userAgent = data.request.get('User-Agent') || null;
        auditLog.endpoint = data.request.originalUrl || data.request.url || null;
        auditLog.httpMethod = data.request.method || null;
      } else {
        auditLog.ipAddress = data.ipAddress || null;
        auditLog.userAgent = data.userAgent || null;
        auditLog.endpoint = data.endpoint || null;
        auditLog.httpMethod = data.httpMethod || null;
      }
      
      auditLog.httpStatus = data.httpStatus || null;
      auditLog.executionTime = data.executionTime || null;

      return await this.auditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.error('Failed to create audit log:', error);
      throw error;
    }
  }

  async logCreate(
    action: AuditAction,
    description: string,
    newData: any,
    userId?: string,
    entityType?: string,
    entityId?: string,
  ): Promise<AuditLog> {
    return this.createLog({
      action,
      description,
      newData,
      userId,
      entityType,
      entityId,
      success: true,
      level: AuditLevel.INFO
    });
  }

  async logUpdate(
    action: AuditAction,
    description: string,
    oldData: any,
    newData: any,
    userId?: string,
    entityType?: string,
    entityId?: string,
  ): Promise<AuditLog> {
    return this.createLog({
      action,
      description,
      previousData: oldData,
      newData,
      userId,
      entityType,
      entityId,
      success: true,
      level: AuditLevel.INFO
    });
  }

  async logDelete(
    action: AuditAction,
    description: string,
    deletedData: any,
    userId?: string,
    entityType?: string,
    entityId?: string,
  ): Promise<AuditLog> {
    return this.createLog({
      action,
      description,
      previousData: deletedData,
      userId,
      entityType,
      entityId,
      success: true,
      level: AuditLevel.INFO
    });
  }

  async findLogs(findDto: any): Promise<PaginatedResponseDto<AuditLog>> {
    const page = findDto.page || 1;
    const limit = Math.min(findDto.limit || 20, 100);
    const skip = (page - 1) * limit;

    // Construir query builder para filtros dinâmicos
    const queryBuilder = this.auditLogRepository.createQueryBuilder('audit_log')
      .leftJoinAndSelect('audit_log.user', 'user')
      .orderBy('audit_log.createdAt', 'DESC');

    // Aplicar filtros
    if (findDto.userId) {
      queryBuilder.andWhere('audit_log.userId = :userId', { userId: findDto.userId });
    }

    if (findDto.action) {
      queryBuilder.andWhere('audit_log.action = :action', { action: findDto.action });
    }

    if (findDto.level) {
      queryBuilder.andWhere('audit_log.level = :level', { level: findDto.level });
    }

    if (findDto.success !== undefined) {
      queryBuilder.andWhere('audit_log.success = :success', { success: findDto.success });
    }

    if (findDto.entityType) {
      queryBuilder.andWhere('audit_log.entityType = :entityType', { entityType: findDto.entityType });
    }

    if (findDto.entityId) {
      queryBuilder.andWhere('audit_log.entityId = :entityId', { entityId: findDto.entityId });
    }

    if (findDto.startDate) {
      queryBuilder.andWhere('audit_log.createdAt >= :startDate', { startDate: findDto.startDate });
    }

    if (findDto.endDate) {
      queryBuilder.andWhere('audit_log.createdAt <= :endDate', { endDate: findDto.endDate });
    }

    if (findDto.ipAddress) {
      queryBuilder.andWhere('audit_log.ipAddress ILIKE :ipAddress', { ipAddress: `%${findDto.ipAddress}%` });
    }

    if (findDto.description) {
      queryBuilder.andWhere('audit_log.description ILIKE :description', { description: `%${findDto.description}%` });
    }

    // Para compatibilidade com o parâmetro 'search' do frontend
    if (findDto.search) {
      queryBuilder.andWhere(
        '(audit_log.description ILIKE :search OR audit_log.ipAddress ILIKE :search OR user.name ILIKE :search)', 
        { search: `%${findDto.search}%` }
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

  async findLogById(id: string): Promise<AuditLog | null> {
    return this.auditLogRepository.findOne({ 
      where: { id },
      relations: ['user']
    });
  }

  extractAuditMetadata(req: any): any {
    if (!req) return {};
    
    return {
      ipAddress: this.extractIpAddress(req),
      userAgent: req.get('User-Agent') || null,
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