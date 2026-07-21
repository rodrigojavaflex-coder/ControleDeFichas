/** Módulos de permissão alinhados ao menu lateral (ordem de exibição). */
export interface PermissionModuleConfig {
  key: string;
  label: string;
  groupKeys: string[];
}

export const PERMISSION_MODULE_CONFIG: PermissionModuleConfig[] = [
  {
    key: 'sistema',
    label: 'Sistema',
    groupKeys: ['Configuração', 'Usuários', 'Perfis', 'Auditoria'],
  },
  {
    key: 'fichas',
    label: 'Fichas',
    groupKeys: ['Fichas Técnicas', 'Certificados'],
  },
  {
    key: 'vendas',
    label: 'Vendas',
    groupKeys: [
      'Vendas',
      'Fechamento de vendas',
      'Caixa',
      'Relatório Análise de Valores',
    ],
  },
  {
    key: 'cadastros',
    label: 'Cadastros',
    groupKeys: ['Clientes', 'Vendedores', 'Prescritores'],
  },
  {
    key: 'folha',
    label: 'Folha',
    groupKeys: [
      'Folha — Funcionários',
      'Folha — Cargos',
      'Folha — Setores',
      'Folha — Verbas',
      'Folha — Tipos',
      'Folha — Lançamentos',
      'Folha — Controle',
      'Folha — Atendimento WhatsApp',
    ],
  },
  {
    key: 'orcamentos',
    label: 'Orçamentos',
    groupKeys: ['Orçamentos — Motivos', 'Orçamentos', 'Orçamentos — Dashboard'],
  },
  {
    key: 'producao',
    label: 'Produção',
    groupKeys: ['Produção — Configuração', 'Produção — Produtividade'],
  },
];
