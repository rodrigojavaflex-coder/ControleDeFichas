import { Permission } from '../models/usuario.model';

export type HomeWidgetId = 'comercial-meu' | 'comercial-unidade';

export interface HomeWidgetDef {
  id: HomeWidgetId;
  permission: Permission;
  /** Ordem de empilhamento na coluna de indicadores. */
  order: number;
}

/** Catálogo de widgets da home (não misturar com atalhos). */
export const HOME_WIDGETS: HomeWidgetDef[] = [
  {
    id: 'comercial-meu',
    permission: Permission.COMERCIAL_ACOMPANHAMENTO_HOME,
    order: 10,
  },
  {
    id: 'comercial-unidade',
    permission: Permission.COMERCIAL_ACOMPANHAMENTO_HOME_UNIDADE,
    order: 20,
  },
];
