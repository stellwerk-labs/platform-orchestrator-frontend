import { QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import {
  getListModuleCatalogueEntriesQueryKey,
  getListModuleVersionsQueryKey,
} from '@src/hooks/react-query/v2/controlplane/modules/modules';
import type { ModuleCatalogueEntry } from '@src/models/v2/controlplane';
import { MockProviders } from '@src/testing-utils/MockProviders';

import { Modules } from './Modules';

const clients: QueryClient[] = [];
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

const renderModules = (summary: 'complete' | 'partial' | 'missing') => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  clients.push(client);
  const modules: ModuleCatalogueEntry[] = ['Redis', 'Postgres'].map((name) => ({
    org_id: 'my-org',
    uuid: name,
    slug: name.toLowerCase(),
    display_name: name,
    description: '',
    resource_type: 'database',
    tags: {},
    status: 'active',
    resource_version: 1,
    managed_default_generation: 1,
    created_at: '2026-11-12T12:00:00Z',
    ...(summary !== 'missing' ? { has_proposed: name === 'Redis' } : {}),
    ...(summary === 'complete' ? { default_verified: false } : {}),
  }));
  client.setQueryData(getListModuleCatalogueEntriesQueryKey('my-org'), modules);
  for (const module of modules)
    client.setQueryData(
      getListModuleVersionsQueryKey('my-org', module.slug, {
        include_deprecated: true,
        include_defective: true,
      }),
      { items: [] },
    );
  render(
    <MockProviders queryClient={client}>
      <Modules />
    </MockProviders>,
  );
};

describe('module quick filters', () => {
  it('combines proposed and search filters, explains an empty result and resets the controls', async () => {
    renderModules('complete');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Has proposed' }));
    expect(screen.getByRole('link', { name: 'Redis' })).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Postgres' })).not.toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search modules' }), 'postgres');
    expect(
      screen.getByText('No modules match these filters. Reset filters to see all modules.'),
    ).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    expect(screen.getByRole('searchbox', { name: 'Search modules' })).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: 'Has proposed' })).not.toBeChecked();
    expect(screen.getByRole('link', { name: 'Postgres' })).toBeVisible();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Default verified' }));
    expect(
      screen.getByText('No modules match these filters. Reset filters to see all modules.'),
    ).toBeVisible();
  });

  it.each(['missing', 'partial'] as const)(
    'disables version filters for %s summary data',
    (summary) => {
      renderModules(summary);
      expect(screen.getByRole('checkbox', { name: 'Has proposed' })).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: 'Default verified' })).toBeDisabled();
      expect(screen.getByText(/Version summaries are unavailable/)).toBeVisible();
      expect(screen.getByRole('link', { name: 'Redis' })).toBeVisible();
    },
  );
});
