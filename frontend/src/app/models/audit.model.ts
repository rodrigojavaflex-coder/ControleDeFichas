export enum AuditAction {
  // Autenticação
  LOGIN = 'auth:login',
  LOGOUT = 'auth:logout',
  LOGIN_FAILED = 'auth:login_failed',
  
  // Usuários
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_PRINT = 'user:print',
  
  // Sistema
  SYSTEM_ACCESS = 'system:access',
  SYSTEM_CONFIG_CHANGE = 'system:config_change',
  
  // Relatórios
  REPORT_GENERATE = 'report:generate',
  REPORT_EXPORT = 'report:export',
  
  // Permissões
  PERMISSION_GRANT = 'permission:grant',
  PERMISSION_REVOKE = 'permission:revoke'
}

export enum AuditLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  userId?: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
  entityType?: string | null;
  entityId?: string | null;
  level: AuditLevel;
  description: string;
  previousData?: any;
  newData?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  endpoint?: string | null;
  httpMethod?: string | null;
  httpStatus?: number | null;
  executionTime?: number | null;
  success: boolean;
  errorMessage?: string | null;
  metadata?: any;
  createdAt: Date;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  userId?: string;
  action?: AuditAction;
  level?: AuditLevel;
  success?: boolean;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
}

export interface PaginatedAuditResponse {
  data: AuditLog[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface AuditActionDescription {
  [key: string]: string;
}

export const AUDIT_ACTION_DESCRIPTIONS: AuditActionDescription = {
  // Autenticação
  [AuditAction.LOGIN]: 'Login no sistema',
  [AuditAction.LOGOUT]: 'Logout do sistema',
  [AuditAction.LOGIN_FAILED]: 'Tentativa de login falhada',
  
  // Usuários
  [AuditAction.USER_CREATE]: 'Inclusão de usuário',
  [AuditAction.USER_READ]: 'Consulta de usuário',
  [AuditAction.USER_UPDATE]: 'Alteração de usuário',
  [AuditAction.USER_DELETE]: 'Exclusão de usuário',
  [AuditAction.USER_PRINT]: 'Impressão de usuário',
  
  // Sistema
  [AuditAction.SYSTEM_ACCESS]: 'Acesso ao sistema',
  [AuditAction.SYSTEM_CONFIG_CHANGE]: 'Alteração de configuração',
  
  // Relatórios
  [AuditAction.REPORT_GENERATE]: 'Geração de relatório',
  [AuditAction.REPORT_EXPORT]: 'Exportação de relatório',
  
  // Permissões
  [AuditAction.PERMISSION_GRANT]: 'Concessão de permissão',
  [AuditAction.PERMISSION_REVOKE]: 'Revogação de permissão'
};

export const AUDIT_LEVEL_DESCRIPTIONS: { [key in AuditLevel]: string } = {
  [AuditLevel.INFO]: 'Informação',
  [AuditLevel.WARNING]: 'Aviso',
  [AuditLevel.ERROR]: 'Erro',
  [AuditLevel.CRITICAL]: 'Crítico'
};

export const AUDIT_LEVEL_COLORS: { [key in AuditLevel]: string } = {
  [AuditLevel.INFO]: 'text-blue-600',
  [AuditLevel.WARNING]: 'text-yellow-600', 
  [AuditLevel.ERROR]: 'text-red-600',
  [AuditLevel.CRITICAL]: 'text-red-800'
};