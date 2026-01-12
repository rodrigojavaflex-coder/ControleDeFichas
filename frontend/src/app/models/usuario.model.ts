import { Vendedor } from './vendedor.model';

export enum Unidade {
  INHUMAS = 'INHUMAS',
  NERÓPOLIS = 'NERÓPOLIS',
  UBERABA = 'UBERABA',
}

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
  PROFILE_READ = 'perfil:read',
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
  VENDA_ACOMPANHAR = 'venda:acompanhar',
  VENDA_ACESSAR_FECHAMENTO = 'venda:acessar-fechamento',

  // Clientes
  CLIENTE_CREATE = 'cliente:create',
  CLIENTE_READ = 'cliente:read',
  CLIENTE_UPDATE = 'cliente:update',
  CLIENTE_DELETE = 'cliente:delete',
  CLIENTE_AUDIT = 'cliente:audit',

  // Vendedores
  VENDEDOR_CREATE = 'vendedor:create',
  VENDEDOR_READ = 'vendedor:read',
  VENDEDOR_UPDATE = 'vendedor:update',
  VENDEDOR_DELETE = 'vendedor:delete',
  VENDEDOR_AUDIT = 'vendedor:audit',

  // Prescritores
  PRESCRITOR_CREATE = 'prescritor:create',
  PRESCRITOR_READ = 'prescritor:read',
  PRESCRITOR_UPDATE = 'prescritor:update',
  PRESCRITOR_DELETE = 'prescritor:delete',
  PRESCRITOR_AUDIT = 'prescritor:audit'
}

export interface PermissionGroup {
  [groupName: string]: {
    key: Permission;
    label: string;
  }[];
}

export interface Perfil {
  id: string;
  nomePerfil: string;
  permissoes: Permission[];
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  perfil?: Perfil | null;
  tema?: string; // Tema preferido do usuário (Claro ou Escuro)
  unidade?: Unidade; // Unidade do usuário
  vendedor?: Vendedor | null; // Vendedor associado ao usuário
  criadoEm: Date;
  atualizadoEm: Date;
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
  tema?: string; // Tema preferido (Claro ou Escuro)
  unidade?: Unidade | null; // Unidade do usuário (null para sem unidade)
  perfilId: string; // ID do perfil do usuário
  vendedorId?: string | null; // ID do vendedor associado ao usuário
}

export interface UpdateUsuarioDto {
  nome?: string;
  email?: string;
  senha?: string;
  ativo?: boolean;
  tema?: string; // Permitir atualizar tema do usuário (Claro ou Escuro)
  unidade?: Unidade | null; // Permitir atualizar unidade do usuário (null para limpar)
  perfilId?: string; // Atualizar perfil do usuário
  vendedorId?: string | null; // Atualizar vendedor associado ao usuário (null para remover)
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
