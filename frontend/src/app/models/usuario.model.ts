export enum Permission {
  CONFIGURACAO_ACCESS = 'configuracao:access',
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

export interface PermissionGroup {
  [groupName: string]: {
    key: Permission;
    label: string;
  }[];
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  permissoes: Permission[];
  criadoEm: Date;
  atualizadoEm: Date;
  tema?: string; // Tema preferido do usuário (Claro ou Escuro)
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface CreateUsuarioDto {
  nome: string;
  email: string;
  senha: string;
  ativo?: boolean;
  permissoes?: Permission[];
  tema?: string; // Tema preferido (Claro ou Escuro)
}

export interface UpdateUsuarioDto {
  nome?: string;
  email?: string;
  senha?: string;
  ativo?: boolean;
  permissoes?: Permission[];
  tema?: string; // Permitir atualizar tema do usuário (Claro ou Escuro)
}

export interface FindUsuariosDto {
  page?: number;
  limit?: number;
  nome?: string;
  email?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}