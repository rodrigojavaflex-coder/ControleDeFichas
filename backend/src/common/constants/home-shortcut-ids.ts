/** IDs válidos de atalhos da tela inicial (espelha o catálogo do frontend). */
export const HOME_SHORTCUT_IDS = [
  'auditoria',
  'users',
  'perfil',
  'configuracao',
  'fichas-tecnicas',
  'vendas',
  'fechamento-vendas',
  'folha-cargos',
  'clientes',
  'folha-verbas',
  'folha-funcionarios',
  'prescritores',
  'folha-setores',
  'folha-tipos',
  'vendedores',
  'folha-lancamentos',
  'folha-controle',
  'folha-atendimento-whatsapp',
  'orcamentos-dashboard',
  'orcamentos',
  'orcamentos-rejeitados',
  'orcamentos-motivos-rejeicao',
  'relatorios-baixas',
  'relatorios-fechamento-caixa',
  'relatorios-acompanhar-vendas',
  'relatorios-analise-valores',
] as const;

export type HomeShortcutId = (typeof HOME_SHORTCUT_IDS)[number];

export const HOME_SHORTCUTS_MAX = 8;

export const HOME_SHORTCUT_ID_SET = new Set<string>(HOME_SHORTCUT_IDS);
