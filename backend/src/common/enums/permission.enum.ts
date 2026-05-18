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
  VENDA_ACOMPANHAR = 'venda:acompanhar',
  VENDA_ACESSAR_FECHAMENTO = 'venda:acessar-fechamento',
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

  // Folha — Funcionários (cadastro + vínculos por unidade)
  FOLHA_FUNCIONARIO_CREATE = 'folha-funcionario:create',
  FOLHA_FUNCIONARIO_READ = 'folha-funcionario:read',
  FOLHA_FUNCIONARIO_UPDATE = 'folha-funcionario:update',
  FOLHA_FUNCIONARIO_DELETE = 'folha-funcionario:delete',

  /** Cadastro global — cargos (vínculo no funcionário) */
  FOLHA_CARGO_CREATE = 'folha-cargo:create',
  FOLHA_CARGO_READ = 'folha-cargo:read',
  FOLHA_CARGO_UPDATE = 'folha-cargo:update',
  FOLHA_CARGO_DELETE = 'folha-cargo:delete',
  FOLHA_CARGO_AUDIT = 'folha-cargo:audit',

  /** Cadastro global — setores (vínculo no funcionário) */
  FOLHA_SETOR_CREATE = 'folha-setor:create',
  FOLHA_SETOR_READ = 'folha-setor:read',
  FOLHA_SETOR_UPDATE = 'folha-setor:update',
  FOLHA_SETOR_DELETE = 'folha-setor:delete',
  FOLHA_SETOR_AUDIT = 'folha-setor:audit',

  // Folha — Verbas (eventos receita/despesa)
  FOLHA_VERBA_CREATE = 'folha-verba:create',
  FOLHA_VERBA_READ = 'folha-verba:read',
  FOLHA_VERBA_UPDATE = 'folha-verba:update',
  FOLHA_VERBA_DELETE = 'folha-verba:delete',

  // Folha — Tipos de folha (mensal, férias, etc.)
  FOLHA_TIPO_CREATE = 'folha-tipo:create',
  FOLHA_TIPO_READ = 'folha-tipo:read',
  FOLHA_TIPO_UPDATE = 'folha-tipo:update',
  FOLHA_TIPO_DELETE = 'folha-tipo:delete',

  // Folha — Lançamentos (folha_capa + folha_item)
  FOLHA_LANCAMENTO_CREATE = 'folha-lancamento:create',
  FOLHA_LANCAMENTO_READ = 'folha-lancamento:read',
  FOLHA_LANCAMENTO_UPDATE = 'folha-lancamento:update',
  FOLHA_LANCAMENTO_DELETE = 'folha-lancamento:delete',
  /** Trava edição de itens e cadastro do funcionário para esta capa (lote aberto). */
  FOLHA_LANCAMENTO_CONGELAR_CAPA = 'folha-lancamento:congelar-capa',
  /** Reverte o congelamento da capa (lote aberto). */
  FOLHA_LANCAMENTO_LIBERAR_CAPA = 'folha-lancamento:liberar-capa',

  // Folha — Controle (competência / folha_fechamento)
  FOLHA_FECHAMENTO_READ = 'folha-fechamento:read',
  FOLHA_FECHAMENTO_REGISTRAR_ABERTURA = 'folha-fechamento:registrar-abertura',
  FOLHA_FECHAMENTO_FECHAR = 'folha-fechamento:fechar',
  FOLHA_FECHAMENTO_REABRIR = 'folha-fechamento:reabrir',
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
    { key: Permission.VENDA_ACOMPANHAR, label: 'Acompanhar vendas por unidade' },
    { key: Permission.VENDA_ACESSAR_FECHAMENTO, label: 'Acessar tela de fechamento de vendas' },
    { key: Permission.VENDA_ANALISE_VALORES, label: 'Acessar relatório Análise de Valores' },
  ],
  Clientes: [
    { key: Permission.CLIENTE_CREATE, label: 'Criar clientes' },
    { key: Permission.CLIENTE_READ, label: 'Visualizar clientes' },
    { key: Permission.CLIENTE_UPDATE, label: 'Editar clientes' },
    { key: Permission.CLIENTE_DELETE, label: 'Excluir clientes' },
    { key: Permission.CLIENTE_AUDIT, label: 'Visualizar auditoria' },
  ],
  Vendedores: [
    { key: Permission.VENDEDOR_CREATE, label: 'Criar vendedores' },
    { key: Permission.VENDEDOR_READ, label: 'Visualizar vendedores' },
    { key: Permission.VENDEDOR_UPDATE, label: 'Editar vendedores' },
    { key: Permission.VENDEDOR_DELETE, label: 'Excluir vendedores' },
    { key: Permission.VENDEDOR_AUDIT, label: 'Visualizar auditoria' },
  ],
  Prescritores: [
    { key: Permission.PRESCRITOR_CREATE, label: 'Criar prescritores' },
    { key: Permission.PRESCRITOR_READ, label: 'Visualizar prescritores' },
    { key: Permission.PRESCRITOR_UPDATE, label: 'Editar prescritores' },
    { key: Permission.PRESCRITOR_DELETE, label: 'Excluir prescritores' },
    { key: Permission.PRESCRITOR_AUDIT, label: 'Visualizar auditoria' },
  ],
  'Folha — Funcionários': [
    { key: Permission.FOLHA_FUNCIONARIO_CREATE, label: 'Criar funcionários (folha)' },
    { key: Permission.FOLHA_FUNCIONARIO_READ, label: 'Visualizar funcionários (folha)' },
    { key: Permission.FOLHA_FUNCIONARIO_UPDATE, label: 'Editar funcionários (folha)' },
    { key: Permission.FOLHA_FUNCIONARIO_DELETE, label: 'Excluir funcionários (folha)' },
  ],
  'Folha — Cargos': [
    { key: Permission.FOLHA_CARGO_CREATE, label: 'Criar cargos (folha)' },
    { key: Permission.FOLHA_CARGO_READ, label: 'Visualizar cargos (folha)' },
    { key: Permission.FOLHA_CARGO_UPDATE, label: 'Editar cargos (folha)' },
    { key: Permission.FOLHA_CARGO_DELETE, label: 'Excluir cargos (folha)' },
    { key: Permission.FOLHA_CARGO_AUDIT, label: 'Visualizar auditoria de cargos (folha)' },
  ],
  'Folha — Setores': [
    { key: Permission.FOLHA_SETOR_CREATE, label: 'Criar setores (folha)' },
    { key: Permission.FOLHA_SETOR_READ, label: 'Visualizar setores (folha)' },
    { key: Permission.FOLHA_SETOR_UPDATE, label: 'Editar setores (folha)' },
    { key: Permission.FOLHA_SETOR_DELETE, label: 'Excluir setores (folha)' },
    { key: Permission.FOLHA_SETOR_AUDIT, label: 'Visualizar auditoria de setores (folha)' },
  ],
  'Folha — Verbas': [
    { key: Permission.FOLHA_VERBA_CREATE, label: 'Criar verbas (folha)' },
    { key: Permission.FOLHA_VERBA_READ, label: 'Visualizar verbas (folha)' },
    { key: Permission.FOLHA_VERBA_UPDATE, label: 'Editar verbas (folha)' },
    { key: Permission.FOLHA_VERBA_DELETE, label: 'Excluir verbas (folha)' },
  ],
  'Folha — Tipos': [
    { key: Permission.FOLHA_TIPO_CREATE, label: 'Criar tipos de folha' },
    { key: Permission.FOLHA_TIPO_READ, label: 'Visualizar tipos de folha' },
    { key: Permission.FOLHA_TIPO_UPDATE, label: 'Editar tipos de folha' },
    { key: Permission.FOLHA_TIPO_DELETE, label: 'Excluir tipos de folha' },
  ],
  'Folha — Lançamentos': [
    { key: Permission.FOLHA_LANCAMENTO_CREATE, label: 'Criar capa e itens da folha' },
    { key: Permission.FOLHA_LANCAMENTO_READ, label: 'Visualizar lançamentos da folha' },
    { key: Permission.FOLHA_LANCAMENTO_UPDATE, label: 'Editar valores de itens da folha' },
    { key: Permission.FOLHA_LANCAMENTO_DELETE, label: 'Excluir itens da folha' },
    { key: Permission.FOLHA_LANCAMENTO_CONGELAR_CAPA, label: 'Congelar folha (capa) do funcionário' },
    { key: Permission.FOLHA_LANCAMENTO_LIBERAR_CAPA, label: 'Liberar folha (capa) para modificação' },
  ],
  'Folha — Controle': [
    {
      key: Permission.FOLHA_FECHAMENTO_READ,
      label: 'Visualizar controle de competências da folha',
    },
    {
      key: Permission.FOLHA_FECHAMENTO_REGISTRAR_ABERTURA,
      label: 'Registrar abertura de competência',
    },
    {
      key: Permission.FOLHA_FECHAMENTO_FECHAR,
      label: 'Fechar lote da competência',
    },
    {
      key: Permission.FOLHA_FECHAMENTO_REABRIR,
      label: 'Reabrir competência (lote fechado)',
    },
  ],
};

export const ALL_PERMISSIONS = Object.values(Permission);
