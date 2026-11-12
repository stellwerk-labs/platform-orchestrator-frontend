import { describe, expect, it } from 'vitest';

import type { ModuleCatalogueEntry } from '@src/models/v2/controlplane';

import { filterModules, ModuleFilters } from './module-filters';

const filters: ModuleFilters = {
  search: '',
  hasProposed: false,
  defaultVerified: false,
  noDefault: false,
  migrationOnly: false,
};
const module: ModuleCatalogueEntry = {
  org_id: 'acme',
  uuid: 'module',
  slug: 'redis-cache',
  display_name: 'Primary cache',
  description: '',
  resource_type: 'database',
  status: 'active',
  tags: {},
  resource_version: 1,
  managed_default_generation: 1,
  created_at: '2026-11-12T12:00:00Z',
  current_default_version_uuid: 'default',
  has_proposed: true,
  default_verified: false,
};

describe('module filters', () => {
  it('combines resource type, case-insensitive name or slug search and complete proposed summaries', () => {
    const workload = { ...module, resource_type: 'workload' };
    expect(
      filterModules([module, workload], {
        ...filters,
        search: '  REDIS ',
        resourceType: 'database',
        hasProposed: true,
      }),
    ).toEqual([module]);
    expect(filterModules([module], { ...filters, search: 'Primary' })).toEqual([module]);
  });

  it('keeps omitted summaries distinct from an explicit false', () => {
    const unknown = { ...module, has_proposed: undefined };
    const noProposed = { ...module, has_proposed: false };
    expect(filterModules([module, unknown, noProposed], { ...filters, hasProposed: true })).toEqual(
      [module],
    );
    expect(filterModules([module, unknown, noProposed], filters)).toEqual([
      module,
      unknown,
      noProposed,
    ]);
  });

  it('supports no-default and existing migration views, including conflicting filters', () => {
    const empty = { ...module, current_default_version_uuid: undefined, has_proposed: false };
    const legacy = { ...module, managed_default_generation: 0 };
    expect(filterModules([module, empty, legacy], { ...filters, noDefault: true })).toEqual([
      empty,
    ]);
    expect(filterModules([module, empty, legacy], { ...filters, migrationOnly: true })).toEqual([
      legacy,
    ]);
    expect(filterModules([empty], { ...filters, noDefault: true, hasProposed: true })).toEqual([]);
  });
});
