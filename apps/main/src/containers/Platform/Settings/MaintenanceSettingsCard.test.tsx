import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from 'antd';
import { afterEach, describe, expect, it } from 'vitest';

import { MaintenanceSettingsCard } from './MaintenanceSettingsCard';
import { maintenancePath, maintenanceStatusPath } from './settingsApi';

const clients: QueryClient[] = [];
afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

const renderCard = (enabled: boolean, canWrite = true) => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  clients.push(client);
  client.setQueryData([maintenancePath], { enabled, revision: 7 });
  client.setQueryData([maintenanceStatusPath], {
    enabled,
    revision: 7,
    state: 'running',
    plugins: [],
  });
  render(
    <QueryClientProvider client={client}>
      <App>
        <MaintenanceSettingsCard canWrite={canWrite} />
      </App>
    </QueryClientProvider>,
  );
};

describe('maintenance button', () => {
  it.each([false, true])(
    'shows the current state %s and confirms the opposite state',
    async (enabled) => {
      renderCard(enabled);
      const button = screen.getByRole('button', {
        name: `Maintenance mode ${enabled ? 'ON' : 'OFF'}`,
      });
      expect(button).toHaveAttribute('aria-pressed', String(enabled));
      await userEvent.click(button);
      expect(
        await screen.findByRole('dialog', {
          name: enabled ? 'Accept new deployments again?' : 'Enable maintenance mode?',
        }),
      ).toBeVisible();
    },
  );

  it('keeps the visible state read-only without write permission', () => {
    renderCard(true, false);
    expect(screen.getByRole('button', { name: 'Maintenance mode ON' })).toBeDisabled();
  });
});
