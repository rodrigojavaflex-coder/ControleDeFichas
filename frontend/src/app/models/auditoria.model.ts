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

  // Operações Específicas
  CHANGE_PASSWORD = 'change_password',
}

export const AUDIT_ACTION_DESCRIPTIONS: Record<AuditAction, string> = {
  [AuditAction.LOGIN]: 'Login',
  [AuditAction.LOGOUT]: 'Logout',
  [AuditAction.LOGIN_FAILED]: 'Falha no Login',
  [AuditAction.CREATE]: 'Criação',
  [AuditAction.READ]: 'Consulta',
  [AuditAction.UPDATE]: 'Atualização',
  [AuditAction.DELETE]: 'Exclusão',
  [AuditAction.CHANGE_PASSWORD]: 'Alteração de Senha'
};

export interface Auditoria {
  id: string;
  acao: AuditAction;
  descricao: string | null;
  usuarioId: string | null;
  usuario?: {
    id: string;
    nome: string;  // Campo correto do backend
    email: string;
  };
  entidade: string | null;
  entidadeId: string | null;
  dadosAnteriores: any;
  dadosNovos: any;
  enderecoIp: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  acao?: AuditAction;
  usuarioId?: string;
  entidade?: string;
  startDate?: string;  // Data de início em formato ISO string
  endDate?: string;    // Data de fim em formato ISO string  
  search?: string;
}

export interface PaginatedAuditResponse {
  data: Auditoria[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
}

export interface UndoableChange {
  id: string;
  acao: AuditAction;
  descricao: string;
  usuarioId: string | null;
  usuario?: {
    id: string;
    nome: string;  // Campo correto do backend
    email: string;
  };
  criadoEm: Date;
  canUndo: boolean;
  undoTimeLimit: Date;
}

export interface RollbackResult {
  success: boolean;
  message: string;
  details?: any;
}

export function getEntityDisplayName(entityType: string): string {
  const entityNames: Record<string, string> = {
    'users': 'Usuário',
    'ficha_tecnica': 'Ficha Técnica',
    'configuracao': 'Configuração',
    'auditoria': 'Auditoria'
  };
  return entityNames[entityType] || entityType;
}