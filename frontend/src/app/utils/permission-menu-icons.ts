import { getNavigationMenuIconHtml } from '../components/navigation/navigation-lucide-svgs';

/** Ícones dos módulos de permissão (alinhados ao menu lateral). */
export const PERMISSION_MODULE_ICON_KEYS: Record<string, string> = {
  sistema: 'feather-cog',
  fichas: 'feather-layers',
  vendas: 'feather-shopping-cart',
  cadastros: 'feather-user',
  folha: 'feather-briefcase',
  orcamentos: 'feather-file-text',
  producao: 'feather-layers',
};

/** Ícones das telas/grupos (labels de PERMISSION_MODULE_CONFIG.groupKeys). */
export const PERMISSION_GROUP_ICON_KEYS: Record<string, string> = {
  Configuração: 'feather-sliders',
  Usuários: 'feather-users',
  Perfis: 'feather-shield',
  Auditoria: 'feather-eye',
  'Fichas Técnicas': 'feather-layers',
  Certificados: 'feather-file-text',
  Vendas: 'feather-shopping-cart',
  'Fechamento de vendas': 'feather-check-circle',
  Caixa: 'feather-dollar-sign',
  'Relatório Análise de Valores': 'feather-trending-up',
  Clientes: 'feather-user',
  Vendedores: 'feather-user-check',
  Prescritores: 'feather-user-plus',
  'Folha — Funcionários': 'feather-users',
  'Folha — Cargos': 'feather-briefcase',
  'Folha — Setores': 'feather-aperture',
  'Folha — Verbas': 'feather-list',
  'Folha — Tipos': 'feather-layers',
  'Folha — Lançamentos': 'feather-edit-3',
  'Folha — Controle': 'feather-lock',
  'Folha — Atendimento WhatsApp': 'brand-whatsapp',
  'Orçamentos — Motivos': 'feather-list',
  Orçamentos: 'feather-file-text',
  'Orçamentos — Dashboard': 'feather-bar-chart-2',
  'Produção — Configuração': 'feather-settings',
  'Produção — Produtividade': 'feather-bar-chart-2',
};

export function getPermissionModuleIconKey(moduleKey: string): string {
  return PERMISSION_MODULE_ICON_KEYS[moduleKey] ?? 'feather-file-text';
}

export function getPermissionGroupIconKey(groupKey: string): string {
  return PERMISSION_GROUP_ICON_KEYS[groupKey] ?? 'feather-file-text';
}

export function getPermissionModuleIconHtml(moduleKey: string): string {
  return getNavigationMenuIconHtml(getPermissionModuleIconKey(moduleKey));
}

export function getPermissionGroupIconHtml(groupKey: string): string {
  return getNavigationMenuIconHtml(getPermissionGroupIconKey(groupKey));
}
