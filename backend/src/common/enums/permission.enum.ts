export enum Permission {
  CONFIGURACAO_ACCESS = 'configuracao:access',
  // Usuários
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_PRINT = 'user:print',
  USER_AUDIT = 'user:audit',

  // Fichas Técnicas
  FICHA_TECNICA_CREATE = 'ficha-tecnica:create',
  FICHA_TECNICA_READ = 'ficha-tecnica:read',
  FICHA_TECNICA_UPDATE = 'ficha-tecnica:update',
  FICHA_TECNICA_DELETE = 'ficha-tecnica:delete',
  FICHA_TECNICA_AUDIT = 'ficha-tecnica:audit',

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
  AUDIT_MANAGE = 'audit:manage',
  // Perfis
  PROFILE_CREATE = 'perfil:create',
  PROFILE_READ   = 'perfil:read',
  PROFILE_UPDATE = 'perfil:update',
  PROFILE_DELETE = 'perfil:delete',

  // Certificados
  CERTIFICADO_CREATE = 'certificado:create',
  CERTIFICADO_READ = 'certificado:read',
  CERTIFICADO_UPDATE = 'certificado:update',
  CERTIFICADO_DELETE = 'certificado:delete',
  CERTIFICADO_AUDIT = 'certificado:audit',

  // Vendas
  VENDA_CREATE = 'venda:create',
  VENDA_READ = 'venda:read',
  VENDA_UPDATE = 'venda:update',
  VENDA_DELETE = 'venda:delete',
  VENDA_BAIXAR = 'venda:baixar',
  VENDA_REMOVE_BAIXA = 'venda:remove-baixa',
  VENDA_AUDIT = 'venda:audit',
  VENDA_FECHAR = 'venda:fechar',
  VENDA_CANCELAR_FECHAMENTO = 'venda:cancelar-fechamento',
  VENDA_VIEW_VALOR_COMPRA = 'venda:view-valor-compra',
}

export const PERMISSION_GROUPS = {
  Configuração: [
    {
      key: Permission.CONFIGURACAO_ACCESS,
      label: 'Acessar tela de configuração',
    },
  ],
  Usuários: [
    { key: Permission.USER_CREATE, label: 'Criar usuários' },
    { key: Permission.USER_READ, label: 'Visualizar usuários' },
    { key: Permission.USER_UPDATE, label: 'Editar usuários' },
    { key: Permission.USER_DELETE, label: 'Excluir usuários' },
    { key: Permission.USER_PRINT, label: 'Imprimir relatórios de usuários' },
    { key: Permission.USER_AUDIT, label: 'Visualizar auditoria' },
  ],
  'Fichas Técnicas': [
    { key: Permission.FICHA_TECNICA_CREATE, label: 'Criar fichas técnicas' },
    { key: Permission.FICHA_TECNICA_READ, label: 'Visualizar fichas técnicas' },
    { key: Permission.FICHA_TECNICA_UPDATE, label: 'Editar fichas técnicas' },
    { key: Permission.FICHA_TECNICA_DELETE, label: 'Excluir fichas técnicas' },
    { key: Permission.FICHA_TECNICA_AUDIT, label: 'Visualizar auditoria' },
  ],
  Administração: [
    { key: Permission.ADMIN_FULL, label: 'Administração completa' },
  ],
  Sistema: [
    { key: Permission.SYSTEM_CONFIG, label: 'Configurações do sistema' },
    { key: Permission.SYSTEM_LOGS, label: 'Visualizar logs do sistema' },
  ],
  Relatórios: [
    { key: Permission.REPORTS_VIEW, label: 'Visualizar relatórios' },
    { key: Permission.REPORTS_EXPORT, label: 'Exportar relatórios' },
  ],
  Auditoria: [
    { key: Permission.AUDIT_VIEW, label: 'Visualizar logs de auditoria' },
    { key: Permission.AUDIT_MANAGE, label: 'Gerenciar logs de auditoria' },
  ],
  Perfis: [
    { key: Permission.PROFILE_CREATE, label: 'Criar perfis' },
    { key: Permission.PROFILE_READ, label: 'Visualizar perfis' },
    { key: Permission.PROFILE_UPDATE, label: 'Editar perfis' },
    { key: Permission.PROFILE_DELETE, label: 'Excluir perfis' },
  ],
  Certificados: [
    { key: Permission.CERTIFICADO_CREATE, label: 'Criar certificados' },
    { key: Permission.CERTIFICADO_READ, label: 'Visualizar certificados' },
    { key: Permission.CERTIFICADO_UPDATE, label: 'Editar certificados' },
    { key: Permission.CERTIFICADO_DELETE, label: 'Excluir certificados' },
    { key: Permission.CERTIFICADO_AUDIT, label: 'Visualizar auditoria' },
  ],
  Vendas: [
    { key: Permission.VENDA_CREATE, label: 'Criar vendas' },
    { key: Permission.VENDA_READ, label: 'Visualizar vendas' },
    { key: Permission.VENDA_UPDATE, label: 'Editar vendas' },
    { key: Permission.VENDA_DELETE, label: 'Excluir vendas' },
    { key: Permission.VENDA_BAIXAR, label: 'Baixar vendas' },
    { key: Permission.VENDA_REMOVE_BAIXA, label: 'Remover baixas' },
    { key: Permission.VENDA_AUDIT, label: 'Visualizar auditoria' },
    { key: Permission.VENDA_FECHAR, label: 'Fechar vendas' },
    { key: Permission.VENDA_CANCELAR_FECHAMENTO, label: 'Cancelar fechamento de vendas' },
    { key: Permission.VENDA_VIEW_VALOR_COMPRA, label: 'Visualizar valor de compra' },
  ],
};

export const ALL_PERMISSIONS = Object.values(Permission);
