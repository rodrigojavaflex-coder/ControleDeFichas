import { Permission } from '../models/usuario.model';

export interface HomeShortcutDef {
  id: string;
  label: string;
  route: string;
  icon: string;
  category: string;
  requiredPermissions: Permission[];
}

/** Máximo de atalhos na tela inicial. */
export const HOME_SHORTCUTS_MAX = 8;

/** Atalhos sugeridos quando o usuário ainda não personalizou. */
export const DEFAULT_HOME_SHORTCUT_IDS: readonly string[] = [
  'vendas',
  'folha-lancamentos',
  'clientes',
  'folha-funcionarios',
];

export const HOME_SHORTCUTS_CATALOG: readonly HomeShortcutDef[] = [
  {
    id: 'auditoria',
    label: 'Auditoria',
    route: '/auditoria',
    icon: 'feather-eye',
    category: 'Sistema',
    requiredPermissions: [Permission.AUDIT_VIEW],
  },
  {
    id: 'users',
    label: 'Usuários',
    route: '/users',
    icon: 'feather-users',
    category: 'Sistema',
    requiredPermissions: [
      Permission.USER_CREATE,
      Permission.USER_READ,
      Permission.USER_UPDATE,
      Permission.USER_DELETE,
    ],
  },
  {
    id: 'perfil',
    label: 'Perfis',
    route: '/perfil',
    icon: 'feather-shield',
    category: 'Sistema',
    requiredPermissions: [
      Permission.PROFILE_CREATE,
      Permission.PROFILE_READ,
      Permission.PROFILE_UPDATE,
      Permission.PROFILE_DELETE,
    ],
  },
  {
    id: 'configuracao',
    label: 'Configuração',
    route: '/configuracao',
    icon: 'feather-sliders',
    category: 'Sistema',
    requiredPermissions: [Permission.CONFIGURACAO_ACCESS],
  },
  {
    id: 'fichas-tecnicas',
    label: 'Fichas Técnicas',
    route: '/fichas-tecnicas',
    icon: 'feather-layers',
    category: 'Fichas',
    requiredPermissions: [
      Permission.FICHA_TECNICA_CREATE,
      Permission.FICHA_TECNICA_READ,
      Permission.FICHA_TECNICA_UPDATE,
      Permission.FICHA_TECNICA_DELETE,
    ],
  },
  {
    id: 'vendas',
    label: 'Vendas',
    route: '/vendas',
    icon: 'feather-shopping-cart',
    category: 'Vendas',
    requiredPermissions: [
      Permission.VENDA_CREATE,
      Permission.VENDA_READ,
      Permission.VENDA_UPDATE,
      Permission.VENDA_DELETE,
    ],
  },
  {
    id: 'fechamento-vendas',
    label: 'Fechamento',
    route: '/fechamento-vendas',
    icon: 'feather-check-circle',
    category: 'Vendas',
    requiredPermissions: [Permission.VENDA_ACESSAR_FECHAMENTO],
  },
  {
    id: 'folha-cargos',
    label: 'Cargos',
    route: '/folha/cargos',
    icon: 'feather-briefcase',
    category: 'Cadastros',
    requiredPermissions: [
      Permission.FOLHA_CARGO_CREATE,
      Permission.FOLHA_CARGO_READ,
      Permission.FOLHA_CARGO_UPDATE,
      Permission.FOLHA_CARGO_DELETE,
    ],
  },
  {
    id: 'clientes',
    label: 'Clientes',
    route: '/clientes',
    icon: 'feather-user',
    category: 'Cadastros',
    requiredPermissions: [
      Permission.CLIENTE_CREATE,
      Permission.CLIENTE_READ,
      Permission.CLIENTE_UPDATE,
      Permission.CLIENTE_DELETE,
    ],
  },
  {
    id: 'folha-verbas',
    label: 'Eventos',
    route: '/folha/verbas',
    icon: 'feather-list',
    category: 'Cadastros',
    requiredPermissions: [
      Permission.FOLHA_VERBA_CREATE,
      Permission.FOLHA_VERBA_READ,
      Permission.FOLHA_VERBA_UPDATE,
      Permission.FOLHA_VERBA_DELETE,
    ],
  },
  {
    id: 'folha-funcionarios',
    label: 'Funcionários',
    route: '/folha/funcionarios',
    icon: 'feather-users',
    category: 'Cadastros',
    requiredPermissions: [
      Permission.FOLHA_FUNCIONARIO_CREATE,
      Permission.FOLHA_FUNCIONARIO_READ,
      Permission.FOLHA_FUNCIONARIO_UPDATE,
      Permission.FOLHA_FUNCIONARIO_DELETE,
    ],
  },
  {
    id: 'prescritores',
    label: 'Prescritores',
    route: '/prescritores',
    icon: 'feather-user-plus',
    category: 'Cadastros',
    requiredPermissions: [
      Permission.PRESCRITOR_CREATE,
      Permission.PRESCRITOR_READ,
      Permission.PRESCRITOR_UPDATE,
      Permission.PRESCRITOR_DELETE,
    ],
  },
  {
    id: 'folha-setores',
    label: 'Setores',
    route: '/folha/setores',
    icon: 'feather-aperture',
    category: 'Cadastros',
    requiredPermissions: [
      Permission.FOLHA_SETOR_CREATE,
      Permission.FOLHA_SETOR_READ,
      Permission.FOLHA_SETOR_UPDATE,
      Permission.FOLHA_SETOR_DELETE,
    ],
  },
  {
    id: 'folha-tipos',
    label: 'Tipo de Folha',
    route: '/folha/tipos',
    icon: 'feather-layers',
    category: 'Cadastros',
    requiredPermissions: [
      Permission.FOLHA_TIPO_CREATE,
      Permission.FOLHA_TIPO_READ,
      Permission.FOLHA_TIPO_UPDATE,
      Permission.FOLHA_TIPO_DELETE,
    ],
  },
  {
    id: 'vendedores',
    label: 'Vendedores',
    route: '/vendedores',
    icon: 'feather-user-check',
    category: 'Cadastros',
    requiredPermissions: [
      Permission.VENDEDOR_CREATE,
      Permission.VENDEDOR_READ,
      Permission.VENDEDOR_UPDATE,
      Permission.VENDEDOR_DELETE,
    ],
  },
  {
    id: 'folha-lancamentos',
    label: 'Lançamentos',
    route: '/folha/lancamentos',
    icon: 'feather-edit-3',
    category: 'Folha',
    requiredPermissions: [
      Permission.FOLHA_LANCAMENTO_CREATE,
      Permission.FOLHA_LANCAMENTO_READ,
      Permission.FOLHA_LANCAMENTO_UPDATE,
      Permission.FOLHA_LANCAMENTO_DELETE,
    ],
  },
  {
    id: 'folha-controle',
    label: 'Controle',
    route: '/folha/controle',
    icon: 'feather-lock',
    category: 'Folha',
    requiredPermissions: [
      Permission.FOLHA_FECHAMENTO_READ,
      Permission.FOLHA_FECHAMENTO_REGISTRAR_ABERTURA,
      Permission.FOLHA_FECHAMENTO_FECHAR,
      Permission.FOLHA_FECHAMENTO_REABRIR,
    ],
  },
  {
    id: 'folha-atendimento-whatsapp',
    label: 'Atendimento WhatsApp',
    route: '/folha/atendimento-whatsapp',
    icon: 'brand-whatsapp',
    category: 'Folha',
    requiredPermissions: [Permission.FOLHA_WHATSAPP_READ],
  },
  {
    id: 'orcamentos-dashboard',
    label: 'Indicadores',
    route: '/orcamentos/dashboard',
    icon: 'feather-bar-chart-2',
    category: 'Orçamentos',
    requiredPermissions: [Permission.ORCAMENTO_DASHBOARD_READ],
  },
  {
    id: 'orcamentos',
    label: 'Orçamentos',
    route: '/orcamentos',
    icon: 'feather-file-text',
    category: 'Orçamentos',
    requiredPermissions: [
      Permission.ORCAMENTO_REJEITADO_READ,
      Permission.ORCAMENTO_APROVADO_READ,
    ],
  },
  {
    id: 'orcamentos-rejeitados',
    label: 'Orçamentos',
    route: '/orcamentos',
    icon: 'feather-file-text',
    category: 'Orçamentos',
    requiredPermissions: [
      Permission.ORCAMENTO_REJEITADO_READ,
      Permission.ORCAMENTO_APROVADO_READ,
    ],
  },
  {
    id: 'orcamentos-motivos-rejeicao',
    label: 'Motivos de rejeição',
    route: '/orcamentos/motivos-rejeicao',
    icon: 'feather-list',
    category: 'Orçamentos',
    requiredPermissions: [
      Permission.ORCAMENTO_MOTIVO_CREATE,
      Permission.ORCAMENTO_MOTIVO_READ,
      Permission.ORCAMENTO_MOTIVO_UPDATE,
      Permission.ORCAMENTO_MOTIVO_DELETE,
    ],
  },
  {
    id: 'relatorios-baixas',
    label: 'Baixas',
    route: '/relatorios/baixas',
    icon: 'feather-file-text',
    category: 'Relatórios',
    requiredPermissions: [Permission.VENDA_BAIXAR],
  },
  {
    id: 'relatorios-fechamento-caixa',
    label: 'Fechamento de Caixa',
    route: '/relatorios/fechamento-caixa',
    icon: 'feather-dollar-sign',
    category: 'Relatórios',
    requiredPermissions: [Permission.VENDA_FECHAR_CAIXA],
  },
  {
    id: 'relatorios-acompanhar-vendas',
    label: 'Acompanhar (Vendas)',
    route: '/relatorios/acompanhar-vendas',
    icon: 'feather-file-text',
    category: 'Relatórios',
    requiredPermissions: [Permission.VENDA_ACOMPANHAR],
  },
  {
    id: 'relatorios-analise-valores',
    label: 'Análise de Valores',
    route: '/relatorios/analise-valores',
    icon: 'feather-trending-up',
    category: 'Relatórios',
    requiredPermissions: [Permission.VENDA_ANALISE_VALORES],
  },
  {
    id: 'producao-config',
    label: 'Configuração de produção',
    route: '/producao/config',
    icon: 'feather-settings',
    category: 'Produção',
    requiredPermissions: [
      Permission.PRODUCAO_CONFIG_READ,
      Permission.PRODUCAO_CONFIG_UPDATE,
    ],
  },
  {
    id: 'producao-produtividade',
    label: 'Produtividade',
    route: '/producao/produtividade',
    icon: 'feather-bar-chart-2',
    category: 'Produção',
    requiredPermissions: [Permission.PRODUCAO_PRODUTIVIDADE_READ],
  },
] as const;

const catalogById = new Map(HOME_SHORTCUTS_CATALOG.map((s) => [s.id, s]));

export function getHomeShortcutById(id: string): HomeShortcutDef | undefined {
  return catalogById.get(id);
}
