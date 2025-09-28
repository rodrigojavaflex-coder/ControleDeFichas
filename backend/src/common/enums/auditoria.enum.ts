export enum AuditAction {
  // Autenticação
  LOGIN = 'auth:login',
  LOGOUT = 'auth:logout',
  LOGIN_FAILED = 'auth:login_failed',

  // Operações CRUD Genéricas
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',

  // Operações Específicas (apenas quando necessário)
  CHANGE_PASSWORD = 'change_password',
}



export const AUDIT_ACTION_DESCRIPTIONS = {
  [AuditAction.LOGIN]: 'Usuário fez login no sistema',
  [AuditAction.LOGOUT]: 'Usuário fez logout do sistema',
  [AuditAction.LOGIN_FAILED]: 'Tentativa de login falhada',
  [AuditAction.CREATE]: 'Registro foi criado',
  [AuditAction.READ]: 'Registro foi consultado',
  [AuditAction.UPDATE]: 'Registro foi alterado',
  [AuditAction.DELETE]: 'Registro foi removido',
  [AuditAction.CHANGE_PASSWORD]: 'Senha foi alterada',
};
