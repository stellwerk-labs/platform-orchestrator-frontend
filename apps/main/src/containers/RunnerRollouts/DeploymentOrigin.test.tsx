import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { getListPluginsQueryKey } from '@src/plugins/pluginDiscovery';
import type { PluginDescriptor } from '@src/plugins/types';
import { server } from '@src/testing-utils/mswServer';

import { DeploymentOrigin } from './DeploymentOrigin';

describe('Deployment source navigation', () => {
  it.each([true, false])(
    'uses only the current organization discovery for links (%s)',
    (installed) => {
      const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
      const descriptor: PluginDescriptor = {
        id: 'dev.stellwerk.progressive-rollouts',
        display_name: 'Progressive Rollouts',
        state: 'available',
        mode: 'full',
        operations: [],
        ui: {
          sdk_version: '1',
          origin: 'https://plugin.example.invalid',
          entrypoint: '/embed/',
          route_prefix: 'rollouts',
          navigation_label: 'Rollouts',
        },
      };
      client.setQueryData(getListPluginsQueryKey('current-org'), {
        items: installed ? [descriptor] : [],
      });
      client.setQueryData(getListPluginsQueryKey('other-org'), { items: [descriptor] });
      const view = render(
        <QueryClientProvider client={client}>
          <MemoryRouter>
            <DeploymentOrigin
              orgId={'current-org'}
              origin={{
                plugin_id: descriptor.id,
                request_id: 'source-request',
                operation_ref: 'opaque-business-operation',
              }}
            />
          </MemoryRouter>
        </QueryClientProvider>,
      );
      try {
        expect(screen.getByText('source-request')).toBeVisible();
        expect(screen.getByText('opaque-business-operation')).toBeVisible();
        if (installed) {
          expect(screen.getByRole('link', { name: 'Open Progressive Rollouts' })).toHaveAttribute(
            'href',
            '/orgs/current-org/rollouts',
          );
        } else {
          expect(screen.queryByRole('link')).not.toBeInTheDocument();
        }
      } finally {
        view.unmount();
        client.clear();
      }
    },
  );
});

const plugin: PluginDescriptor = {
  id: 'dev.example.workflow',
  display_name: 'Workflow',
  version: '1.2.3',
  state: 'available',
  mode: 'full',
  operations: [{ id: 'resolveDeploymentSource', method: 'GET', mutating: false }],
  ui: {
    sdk_version: '1',
    origin: 'https://plugin.example.invalid',
    entrypoint: '/embed/',
    route_prefix: 'workflow',
    navigation_label: 'Workflow',
  },
};
const mount = (descriptor = plugin) => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(getListPluginsQueryKey('current-org'), { items: [descriptor] });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DeploymentOrigin
          orgId={'current-org'}
          origin={{ plugin_id: plugin.id, request_id: 'retained-request' }}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};
it('uses a declared read operation and composes the exact source beneath the current plugin', async () => {
  server.use(
    http.post(
      'http://example.com/orgs/current-org/plugins/dev.example.workflow/invoke',
      async ({ request }) => {
        expect(await request.json()).toEqual({
          operation_id: 'resolveDeploymentSource',
          path_parameters: { requestId: 'retained-request' },
        });
        return HttpResponse.json({ status: 200, body: { route: '/history/1234' } });
      },
    ),
  );
  const view = mount();
  try {
    expect(await screen.findByRole('link', { name: 'Open Workflow' })).toHaveAttribute(
      'href',
      '/orgs/current-org/workflow/history/1234',
    );
  } finally {
    view.unmount();
  }
});
it.each([
  'https://evil.invalid/path',
  '//evil.invalid/path',
  '/../projects',
  '/%2e%2e/projects',
  '/a\\b',
  '/history/id?org=other',
  '/id#fragment',
  '/a//b',
  '/' + 'x'.repeat(513),
])('refuses unsafe source route %s', async (route) => {
  server.use(
    http.post('http://example.com/orgs/current-org/plugins/dev.example.workflow/invoke', () =>
      HttpResponse.json({ status: 200, body: { route } }),
    ),
  );
  const view = mount();
  try {
    expect(await screen.findByText('Source unavailable')).toBeVisible();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry source link' })).toBeEnabled();
  } finally {
    view.unmount();
  }
});
it('keeps a missing source unavailable and retries the same exact request', async () => {
  let calls = 0;
  server.use(
    http.post('http://example.com/orgs/current-org/plugins/dev.example.workflow/invoke', () =>
      HttpResponse.json(
        ++calls === 1
          ? { status: 404, body: {} }
          : { status: 200, body: { route: '/retained-rollout' } },
      ),
    ),
  );
  const view = mount();
  try {
    await userEvent.click(await screen.findByRole('button', { name: 'Retry source link' }));
    expect(await screen.findByRole('link', { name: 'Open Workflow' })).toHaveAttribute(
      'href',
      '/orgs/current-org/workflow/retained-rollout',
    );
    expect(calls).toBe(2);
  } finally {
    view.unmount();
  }
});

it.each(['POST', 'mutating'])('keeps %s operations out of source resolution', (kind) => {
  const descriptor: PluginDescriptor = {
    ...plugin,
    operations: [
      {
        id: 'resolveDeploymentSource',
        method: kind === 'POST' ? 'POST' : 'GET',
        mutating: kind === 'mutating',
      },
    ],
  };
  const view = mount(descriptor);
  try {
    expect(screen.getByRole('link', { name: 'Open Workflow' })).toHaveAttribute(
      'href',
      '/orgs/current-org/workflow',
    );
    expect(screen.queryByText('Locating source')).not.toBeInTheDocument();
  } finally {
    view.unmount();
  }
});
