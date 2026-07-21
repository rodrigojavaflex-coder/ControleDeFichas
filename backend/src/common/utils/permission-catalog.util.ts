import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  Permission,
} from '../enums/permission.enum';
import { PERMISSION_MODULE_CONFIG } from '../constants/permission-modules';

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

export interface PermissionCatalogResponse {
  modules: PermissionCatalogModule[];
  totalPermissions: number;
}

/** Garante cobertura 100% do enum e dos grupos no catálogo (falha no startup se inconsistente). */
export function assertPermissionCatalogIntegrity(): void {
  const groupedKeys = Object.values(PERMISSION_GROUPS)
    .flat()
    .map((item) => item.key);
  const groupedSet = new Set(groupedKeys);

  for (const perm of ALL_PERMISSIONS) {
    if (!groupedSet.has(perm)) {
      throw new Error(
        `Permissão "${perm}" não está em PERMISSION_GROUPS — atualize o catálogo.`,
      );
    }
  }

  if (groupedKeys.length !== groupedSet.size) {
    throw new Error(
      'PERMISSION_GROUPS contém permissões duplicadas — revise o catálogo.',
    );
  }

  const moduleGroupKeys = PERMISSION_MODULE_CONFIG.flatMap((m) => m.groupKeys);
  const moduleGroupSet = new Set(moduleGroupKeys);
  const allGroupNames = Object.keys(PERMISSION_GROUPS);

  for (const groupName of allGroupNames) {
    if (!moduleGroupSet.has(groupName)) {
      throw new Error(
        `Grupo "${groupName}" não está em PERMISSION_MODULE_CONFIG.`,
      );
    }
  }

  if (moduleGroupKeys.length !== moduleGroupSet.size) {
    throw new Error(
      'PERMISSION_MODULE_CONFIG referencia o mesmo grupo mais de uma vez.',
    );
  }

  for (const key of moduleGroupSet) {
    if (!PERMISSION_GROUPS[key as keyof typeof PERMISSION_GROUPS]) {
      throw new Error(
        `Grupo "${key}" em PERMISSION_MODULE_CONFIG não existe em PERMISSION_GROUPS.`,
      );
    }
  }
}

export function buildPermissionCatalog(): PermissionCatalogResponse {
  const modules: PermissionCatalogModule[] = PERMISSION_MODULE_CONFIG.map(
    (moduleConfig) => ({
      key: moduleConfig.key,
      label: moduleConfig.label,
      groups: moduleConfig.groupKeys.map((groupKey) => ({
        key: groupKey,
        label: groupKey,
        permissions: (
          PERMISSION_GROUPS[groupKey as keyof typeof PERMISSION_GROUPS] ?? []
        ).map((item) => ({
          key: item.key as Permission,
          label: item.label,
        })),
      })),
    }),
  );

  return {
    modules,
    totalPermissions: ALL_PERMISSIONS.length,
  };
}

/** Mapa permissão → módulo (para resumo na listagem). */
export function buildPermissionToModuleMap(): Map<Permission, string> {
  const catalog = buildPermissionCatalog();
  const map = new Map<Permission, string>();
  for (const mod of catalog.modules) {
    for (const group of mod.groups) {
      for (const perm of group.permissions) {
        map.set(perm.key, mod.key);
      }
    }
  }
  return map;
}
