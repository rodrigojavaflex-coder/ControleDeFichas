export enum Permission {
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
  
  // Administração
  ADMIN_FULL = 'admin:full',
  
  // Sistema
  SYSTEM_CONFIG = 'system:config',
  SYSTEM_LOGS = 'system:logs',
  
  // Relatórios
  REPORTS_VIEW = 'reports:view',
  REPORTS_EXPORT = 'reports:export',
  
  // Auditoria
  AUDIT_VIEW = 'audit:view',
  AUDIT_MANAGE = 'audit:manage'
}

export const PERMISSION_GROUPS = {
  'Usuários': [
    { key: Permission.USER_CREATE, label: 'Criar usuários' },
    { key: Permission.USER_READ, label: 'Visualizar usuários' },
    { key: Permission.USER_UPDATE, label: 'Editar usuários' },
    { key: Permission.USER_DELETE, label: 'Excluir usuários' },
    { key: Permission.USER_PRINT, label: 'Imprimir relatórios de usuários' }
  ],
  'Fichas Técnicas': [
    { key: Permission.FICHA_TECNICA_CREATE, label: 'Criar fichas técnicas' },
    { key: Permission.FICHA_TECNICA_READ, label: 'Visualizar fichas técnicas' },
    { key: Permission.FICHA_TECNICA_UPDATE, label: 'Editar fichas técnicas' },
    { key: Permission.FICHA_TECNICA_DELETE, label: 'Excluir fichas técnicas' }
  ],
  'Administração': [
    { key: Permission.ADMIN_FULL, label: 'Administração completa' }
  ],
  'Sistema': [
    { key: Permission.SYSTEM_CONFIG, label: 'Configurações do sistema' },
    { key: Permission.SYSTEM_LOGS, label: 'Visualizar logs do sistema' }
  ],
  'Relatórios': [
    { key: Permission.REPORTS_VIEW, label: 'Visualizar relatórios' },
    { key: Permission.REPORTS_EXPORT, label: 'Exportar relatórios' }
  ],
  'Auditoria': [
    { key: Permission.AUDIT_VIEW, label: 'Visualizar logs de auditoria' },
    { key: Permission.AUDIT_MANAGE, label: 'Gerenciar logs de auditoria' }
  ]
};

export const ALL_PERMISSIONS = Object.values(Permission);