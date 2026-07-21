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
  VENDA_FECHAR_CAIXA = 'venda:fechar-caixa',
  VENDA_REABRIR_CAIXA = 'venda:reabrir-caixa',
  VENDA_ANALISE_VALORES = 'venda:analise-valores',

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
  PRESCRITOR_AUDIT = 'prescritor:audit',

  FOLHA_FUNCIONARIO_CREATE = 'folha-funcionario:create',
  FOLHA_FUNCIONARIO_READ = 'folha-funcionario:read',
  FOLHA_FUNCIONARIO_UPDATE = 'folha-funcionario:update',
  FOLHA_FUNCIONARIO_DELETE = 'folha-funcionario:delete',

  FOLHA_CARGO_CREATE = 'folha-cargo:create',
  FOLHA_CARGO_READ = 'folha-cargo:read',
  FOLHA_CARGO_UPDATE = 'folha-cargo:update',
  FOLHA_CARGO_DELETE = 'folha-cargo:delete',
  FOLHA_CARGO_AUDIT = 'folha-cargo:audit',

  FOLHA_SETOR_CREATE = 'folha-setor:create',
  FOLHA_SETOR_READ = 'folha-setor:read',
  FOLHA_SETOR_UPDATE = 'folha-setor:update',
  FOLHA_SETOR_DELETE = 'folha-setor:delete',
  FOLHA_SETOR_AUDIT = 'folha-setor:audit',

  FOLHA_VERBA_CREATE = 'folha-verba:create',
  FOLHA_VERBA_READ = 'folha-verba:read',
  FOLHA_VERBA_UPDATE = 'folha-verba:update',
  FOLHA_VERBA_DELETE = 'folha-verba:delete',
  FOLHA_VERBA_AUDIT = 'folha-verba:audit',

  FOLHA_TIPO_CREATE = 'folha-tipo:create',
  FOLHA_TIPO_READ = 'folha-tipo:read',
  FOLHA_TIPO_UPDATE = 'folha-tipo:update',
  FOLHA_TIPO_DELETE = 'folha-tipo:delete',

  FOLHA_LANCAMENTO_CREATE = 'folha-lancamento:create',
  FOLHA_LANCAMENTO_READ = 'folha-lancamento:read',
  FOLHA_LANCAMENTO_UPDATE = 'folha-lancamento:update',
  FOLHA_LANCAMENTO_DELETE = 'folha-lancamento:delete',
  FOLHA_LANCAMENTO_DELETE_CAPA = 'folha-lancamento:delete-capa',
  FOLHA_LANCAMENTO_CONGELAR_CAPA = 'folha-lancamento:congelar-capa',
  FOLHA_LANCAMENTO_LIBERAR_CAPA = 'folha-lancamento:liberar-capa',
  FOLHA_LANCAMENTO_ENVIAR_RECIBO_WHATSAPP = 'folha-lancamento:enviar-recibo-whatsapp',

  FOLHA_FECHAMENTO_READ = 'folha-fechamento:read',
  FOLHA_FECHAMENTO_REGISTRAR_ABERTURA = 'folha-fechamento:registrar-abertura',
  FOLHA_FECHAMENTO_FECHAR = 'folha-fechamento:fechar',
  FOLHA_FECHAMENTO_REABRIR = 'folha-fechamento:reabrir',
  FOLHA_FECHAMENTO_ENVIAR_RECIBOS_WHATSAPP = 'folha-fechamento:enviar-recibos-whatsapp',

  FOLHA_WHATSAPP_READ = 'folha-whatsapp:read',
  FOLHA_WHATSAPP_REPLY = 'folha-whatsapp:reply',

  ORCAMENTO_MOTIVO_CREATE = 'orcamento-motivo:create',
  ORCAMENTO_MOTIVO_READ = 'orcamento-motivo:read',
  ORCAMENTO_MOTIVO_UPDATE = 'orcamento-motivo:update',
  ORCAMENTO_MOTIVO_DELETE = 'orcamento-motivo:delete',

  ORCAMENTO_REJEITADO_READ = 'orcamento-rejeitado:read',
  ORCAMENTO_APROVADO_READ = 'orcamento-aprovado:read',
  ORCAMENTO_VIEW_VALORES = 'orcamento:view-valores',
  ORCAMENTO_REJEITADO_UPDATE = 'orcamento-rejeitado:update',
  ORCAMENTO_REJEITADO_SYNC = 'orcamento-rejeitado:sync',
  ORCAMENTO_PRINT = 'orcamento:print',

  ORCAMENTO_DASHBOARD_READ = 'orcamento-dashboard:read',
  ORCAMENTO_DASHBOARD_VIEW_VALORES = 'orcamento-dashboard:view-valores',

  PRODUCAO_CONFIG_READ = 'producao-config:read',
  PRODUCAO_CONFIG_UPDATE = 'producao-config:update',
  PRODUCAO_PRODUTIVIDADE_READ = 'producao-produtividade:read',
}

export interface PermissionGroup {
  [groupName: string]: {
    key: Permission;
    label: string;
  }[];
}

export interface PermissionCatalogItem {
  key: Permission;
  label: string;
}

export interface PermissionCatalogGroup {
  key: string;
  label: string;
  permissions: PermissionCatalogItem[];
}

export interface PermissionCatalogModule {
  key: string;
  label: string;
  groups: PermissionCatalogGroup[];
}

export interface PermissionCatalog {
  modules: PermissionCatalogModule[];
  totalPermissions: number;
}

export interface PerfilUsuarioVinculado {
  id: string;
  nome: string;
  unidade?: Unidade | null;
}

export interface Perfil {
  id: string;
  nomePerfil: string;
  permissoes: Permission[];
  totalUsuarios?: number;
  usuariosVinculados?: PerfilUsuarioVinculado[];
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  /** Perfis vinculados (permissões efetivas = união). */
  perfis?: Perfil[];
  /** @deprecated Use `perfis`. Mantido para sessões antigas no localStorage. */
  perfil?: Perfil | null;
  tema?: string; // Tema preferido do usuário (Claro ou Escuro)
  /** IDs dos atalhos da tela inicial (`null` = usar padrão do sistema). */
  atalhosHome?: string[] | null;
  unidade?: Unidade | null; // Unidade do usuário (null = sem vínculo = escopo conforme RN-007 / admin)
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
  perfilIds: string[];
  vendedorId?: string | null; // ID do vendedor associado ao usuário
}

export interface UpdateUsuarioDto {
  nome?: string;
  email?: string;
  senha?: string;
  ativo?: boolean;
  tema?: string; // Permitir atualizar tema do usuário (Claro ou Escuro)
  unidade?: Unidade | null; // Permitir atualizar unidade do usuário (null para limpar)
  perfilIds?: string[];
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
