import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from 'antd';
import { afterEach, describe, expect, it } from 'vitest';

import { CostEstimationSettingsCard } from './CostEstimationSettingsCard';
import { type CostEstimation, costEstimationPath } from './settingsApi';

const clients: QueryClient[] = [];
afterEach(() => clients.splice(0).forEach((client) => client.clear()));

const renderCard = (values: Partial<CostEstimation> = {}, canWrite = true) => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  clients.push(client);
  client.setQueryData([costEstimationPath], {
    enabled: false,
    api_key_configured: false,
    revision: 7,
    ...values,
  });
  render(
    <QueryClientProvider client={client}>
      <App>
        <CostEstimationSettingsCard canWrite={canWrite} />
      </App>
    </QueryClientProvider>,
  );
};

const estimates = () => screen.getByRole('switch', { name: 'Infrastructure cost estimates' });
const key = () => screen.getByLabelText('Infracost API key');
const save = () => screen.getByRole('button', { name: 'Save cost settings' });

describe('Infracost settings', () => {
  it('defaults off and requires a key to enable estimates', async () => {
    renderCard();
    expect(estimates()).not.toBeChecked();
    expect(save()).toBeEnabled();
    await userEvent.click(estimates());
    expect(save()).toBeDisabled();
    await userEvent.type(key(), 'fixture-key');
    expect(save()).toBeEnabled();
  });

  it('shows only key presence and keeps its input empty', () => {
    renderCard({ enabled: true, api_key_configured: true });
    expect(key()).toHaveValue('');
    expect(key()).toHaveAttribute('type', 'password');
    expect(save()).toBeEnabled();
    expect(screen.getByText(/Leave this field empty to keep it/)).toBeVisible();
  });

  it('requires disabling estimates before removing the saved key', async () => {
    renderCard({ enabled: true, api_key_configured: true });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Remove saved API key' }));
    expect(save()).toBeDisabled();
    expect(key()).toBeDisabled();
    await userEvent.click(estimates());
    expect(save()).toBeEnabled();
  });

  it('keeps credentials and enablement read-only without permission', () => {
    renderCard({ enabled: true, api_key_configured: true }, false);
    expect(estimates()).toBeDisabled();
    expect(key()).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Remove saved API key' })).toBeDisabled();
    expect(save()).toBeDisabled();
  });
});
