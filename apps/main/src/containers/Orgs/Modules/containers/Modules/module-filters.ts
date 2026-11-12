import type { ModuleCatalogueEntry } from '@src/models/v2/controlplane';

export interface ModuleFilters {
  search: string;
  resourceType?: string;
  hasProposed: boolean;
  defaultVerified: boolean;
  noDefault: boolean;
  migrationOnly: boolean;
}

export const filterModules = (modules: ModuleCatalogueEntry[], filters: ModuleFilters) => {
  const search = filters.search.trim().toLowerCase();
  return modules
    .filter(
      (module) =>
        !search ||
        [module.slug, module.display_name, module.resource_type].some((value) =>
          value.toLowerCase().includes(search),
        ),
    )
    .filter((module) => !filters.resourceType || module.resource_type === filters.resourceType)
    .filter((module) => !filters.hasProposed || module.has_proposed === true)
    .filter((module) => !filters.defaultVerified || module.default_verified === true)
    .filter((module) => !filters.noDefault || !module.current_default_version_uuid)
    .filter(
      (module) =>
        !filters.migrationOnly ||
        (module.current_default_version_uuid && module.managed_default_generation === 0),
    );
};
