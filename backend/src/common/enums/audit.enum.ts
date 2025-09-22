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
  
  // Fichas Técnicas
  FICHA_TECNICA_CREATE = 'ficha-tecnica:create',
  FICHA_TECNICA_READ = 'ficha-tecnica:read',
  FICHA_TECNICA_UPDATE = 'ficha-tecnica:update',
  FICHA_TECNICA_DELETE = 'ficha-tecnica:delete',
  
  // Sistema
  SYSTEM_ACCESS = 'system:access',
  SYSTEM_CONFIG_CHANGE = 'system:config_change',
  
  // Relatórios
  REPORT_GENERATE = 'report:generate',
  REPORT_EXPORT = 'report:export',
  
  // Permissões
  PERMISSION_GRANT = 'permission:grant',
  PERMISSION_REVOKE = 'permission:revoke',
  
  // Dados Sensíveis
  SENSITIVE_DATA_ACCESS = 'data:sensitive_access',
  BULK_OPERATION = 'data:bulk_operation'
}

export enum AuditLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export const AUDIT_ACTION_DESCRIPTIONS = {
  [AuditAction.LOGIN]: 'Usuário fez login no sistema',
  [AuditAction.LOGOUT]: 'Usuário fez logout do sistema',
  [AuditAction.LOGIN_FAILED]: 'Tentativa de login falhada',
  [AuditAction.USER_CREATE]: 'Usuário criou novo usuário',
  [AuditAction.USER_READ]: 'Usuário visualizou dados de usuário',
  [AuditAction.USER_UPDATE]: 'Usuário editou dados de usuário',
  [AuditAction.USER_DELETE]: 'Usuário removeu usuário do sistema',
  [AuditAction.USER_PRINT]: 'Usuário gerou relatório de usuário',
  [AuditAction.SYSTEM_ACCESS]: 'Acesso a funcionalidade do sistema',
  [AuditAction.SYSTEM_CONFIG_CHANGE]: 'Alteração na configuração do sistema',
  [AuditAction.REPORT_GENERATE]: 'Relatório foi gerado',
  [AuditAction.REPORT_EXPORT]: 'Relatório foi exportado',
  [AuditAction.PERMISSION_GRANT]: 'Permissão foi concedida',
  [AuditAction.PERMISSION_REVOKE]: 'Permissão foi revogada',
  [AuditAction.SENSITIVE_DATA_ACCESS]: 'Acesso a dados sensíveis',
  [AuditAction.BULK_OPERATION]: 'Operação em lote executada'
};