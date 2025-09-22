import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../services/audit.service';
import { AuditAction, AuditLevel } from '../enums/audit.enum';

export const AUDIT_ACTION_KEY = 'audit_action';
export const AUDIT_ENTITY_TYPE_KEY = 'audit_entity_type';

/**
 * Decorator para marcar endpoints que devem gerar logs de auditoria
 */
export const AuditLog = (action: AuditAction, entityType?: string) => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(AUDIT_ACTION_KEY, action, descriptor.value);
    if (entityType) {
      Reflect.defineMetadata(AUDIT_ENTITY_TYPE_KEY, entityType, descriptor.value);
    }
    return descriptor;
  };
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly auditService: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();
    
    // Verificar se o endpoint tem marcação para auditoria
    const auditAction = this.reflector.get<AuditAction>(AUDIT_ACTION_KEY, handler);
    
    if (!auditAction) {
      return next.handle();
    }

    const entityType = this.reflector.get<string>(AUDIT_ENTITY_TYPE_KEY, handler);
    const startTime = Date.now();
    
    // Extrair informações do usuário logado (assumindo que está no request)
    const userId = (request as any).user?.id;
    
    return next.handle().pipe(
      tap(async (response) => {
        const executionTime = Date.now() - startTime;
        
        try {
          // Determinar entityId com base na resposta ou parâmetros
          const entityId = this.extractEntityId(request, response);
          
          // Obter dados antes/depois dependendo da operação
          const { previousData, newData } = this.extractOperationData(auditAction, request, response);
          
          await this.auditService.createLog({
            action: auditAction,
            userId,
            entityType,
            entityId,
            level: AuditLevel.INFO,
            success: true,
            previousData,
            newData,
            metadata: {
              executionTime,
              responseSize: JSON.stringify(response || {}).length,
            },
            request,
          });
          
        } catch (error) {
          this.logger.error('Failed to create audit log for successful operation', error);
        }
      }),
      catchError(async (error) => {
        const executionTime = Date.now() - startTime;
        
        try {
          await this.auditService.createLog({
            action: auditAction,
            userId,
            entityType,
            level: AuditLevel.ERROR,
            success: false,
            errorMessage: error.message || 'Erro desconhecido',
            metadata: {
              executionTime,
              errorStack: error.stack,
            },
            request,
          });
        } catch (auditError) {
          this.logger.error('Failed to create audit log for failed operation', auditError);
        }
        
        throw error;
      })
    );
  }

  /**
   * Extrai o ID da entidade com base na requisição e resposta
   */
  private extractEntityId(request: Request, response: any): string | undefined {
    // Primeiro, verificar parâmetros da URL (ex: /users/:id)
    if (request.params?.id) {
      return request.params.id;
    }
    
    // Depois verificar na resposta (para operações CREATE)
    if (response?.id) {
      return response.id;
    }
    
    // Para operações de lista, não há ID específico
    return undefined;
  }

  /**
   * Extrai dados da operação (antes/depois) baseado no tipo de ação
   */
  private extractOperationData(
    action: AuditAction, 
    request: Request, 
    response: any
  ): { previousData?: any; newData?: any } {
    switch (action) {
      case AuditAction.USER_CREATE:
        return {
          newData: this.sanitizeUserData(response)
        };
        
      case AuditAction.USER_UPDATE:
        return {
          previousData: (request as any).previousUserData, // Seria definido no controller
          newData: this.sanitizeUserData(response)
        };
        
      case AuditAction.USER_DELETE:
        return {
          previousData: this.sanitizeUserData((request as any).userToDelete)
        };
        
      case AuditAction.USER_PRINT:
        return {
          previousData: {
            userId: request.params?.id,
            generatedAt: new Date().toISOString()
          }
        };
        
      default:
        return {};
    }
  }

  /**
   * Remove dados sensíveis dos dados do usuário antes de armazenar no log
   */
  private sanitizeUserData(userData: any): any {
    if (!userData) return undefined;
    
    const sanitized = { ...userData };
    
    // Remover senha dos logs
    if (sanitized.password) {
      delete sanitized.password;
    }
    
    return sanitized;
  }
}