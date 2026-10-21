import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MockProviders } from '@src/testing-utils/MockProviders';
import { server } from '@src/testing-utils/mswServer';

import { PluginRouteHost } from './PluginRouteHost';
import type { PluginDescriptor } from './types';

const discoveryUrl = 'http://example.com/orgs/:orgId/plugins';
const notFound = "We can't find the page you are looking for.";

const plugin: PluginDescriptor = {
  id: 'dev.stellwerk.progressive-rollouts',
  display_name: 'Progressive Rollouts',
  state: 'available',
  mode: 'full',
  ui: {
    sdk_version: '1',
    origin: 'https://rollouts-ui.example.net',
    entrypoint: '/embed/',
    route_prefix: 'rollouts',
    navigation_label: 'Rollouts',
  },
  operations: [{ id: 'listProgressiveRollouts', method: 'GET', mutating: false }],
};

const history: PluginDescriptor = {
  ...plugin,
  id: 'dev.stellwerk.rollout-history',
  display_name: 'Rollout History',
  ui: { ...plugin.ui!, origin: 'https://history-ui.example.net', route_prefix: 'rollouts/history' },
};

const discover = (...items: unknown[]) =>
  server.use(http.get(discoveryUrl, () => HttpResponse.json({ items })));

const renderHost = (url = '/orgs/org-one/rollouts/history') =>
  render(
    <MockProviders route={{ path: '/orgs/:orgId/*', url }}>
      <PluginRouteHost />
    </MockProviders>,
  );

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('plugin route host', () => {
  it('shows a loading card until discovery for the organization answers', async () => {
    const organizations: unknown[] = [];
    let answer: () => void = () => undefined;
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    server.use(
      http.get(discoveryUrl, async ({ params }) => {
        organizations.push(params.orgId);
        await answered;
        return HttpResponse.json({ items: [plugin] });
      }),
    );
    renderHost('/orgs/org-one/rollouts');
    await waitFor(() => expect(document.querySelector('.ant-card-loading')).toBeInTheDocument());
    expect(screen.queryByTitle(plugin.display_name)).not.toBeInTheDocument();

    answer();
    expect(await screen.findByTitle(plugin.display_name)).toHaveAttribute(
      'src',
      'https://rollouts-ui.example.net/embed/',
    );
    expect(organizations).toEqual(['org-one']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports a failed discovery', async () => {
    server.use(http.get(discoveryUrl, () => new HttpResponse(null, { status: 503 })));
    renderHost();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Plugin discovery failed');
    expect(alert).toHaveTextContent('Request failed with status code 503');
  });

  it.each([
    ['an unregistered path', '/orgs/org-one/unknown'],
    ['a path that only shares a prefix', '/orgs/org-one/rollouts-archive'],
  ])('shows the not-found page for %s', async (_, url) => {
    discover(plugin);
    renderHost(url);
    expect(await screen.findByText(notFound)).toBeInTheDocument();
    expect(screen.queryByTitle(plugin.display_name)).not.toBeInTheDocument();
  });

  it.each<[string, unknown]>([
    ['a visible plugin without a UI contribution', { ...plugin, ui: undefined }],
    ['a hidden plugin', { ...plugin, state: 'unavailable', mode: 'hidden' }],
    ['another UI SDK version', { ...plugin, ui: { ...plugin.ui, sdk_version: '2' } }],
    ['a malformed descriptor', { id: 'Progressive Rollouts', ui: plugin.ui }],
  ])('shows the not-found page instead of mounting %s', async (_, descriptor) => {
    discover(descriptor);
    renderHost();
    expect(await screen.findByText(notFound)).toBeInTheDocument();
    expect(screen.queryByTitle(plugin.display_name)).not.toBeInTheDocument();
  });

  it.each([
    ['/orgs/org-one/rollouts/history/42', history],
    ['/orgs/org-one/rollouts/waves', plugin],
  ])('mounts the plugin with the longest matching route prefix for %s', async (url, expected) => {
    discover(plugin, history);
    renderHost(url);
    expect(await screen.findByTitle(expected.display_name)).toHaveAttribute(
      'src',
      `${expected.ui!.origin}/embed/`,
    );
    expect(screen.getAllByTitle(/Rollout/)).toHaveLength(1);
  });

  it.each([
    [
      'the Console hostname on another port',
      { origin: 'https://localhost:8443' },
      'Plugin UI pages must use a different hostname from the Console.',
    ],
    // VITE_BASE_URL, the Console's API base URL, is http://example.com as in CI.
    [
      'the API hostname',
      { origin: 'https://example.com' },
      'Plugin UI pages must not use the API hostname or a subdomain of it, which receive the session cookie.',
    ],
    [
      'a subdomain of the API hostname on another port',
      { origin: 'https://rollouts.example.com:8443' },
      'Plugin UI pages must not use the API hostname or a subdomain of it, which receive the session cookie.',
    ],
    [
      'plain HTTP',
      { origin: 'http://rollouts-ui.example.net' },
      'Plugin UI origins must use HTTPS.',
    ],
    [
      'an origin with a path',
      { origin: 'https://rollouts-ui.example.net/embed' },
      'The plugin UI origin must be a canonical origin without credentials or a path.',
    ],
    [
      'credentials in the origin',
      { origin: 'https://user:secret@rollouts-ui.example.net' },
      'The plugin UI origin must be a canonical origin without credentials or a path.',
    ],
    [
      'an entrypoint on another origin',
      { entrypoint: 'https://attacker.example.org/embed/' },
      'The plugin UI entrypoint must stay on its registered origin.',
    ],
    [
      'an entrypoint with a fragment',
      { entrypoint: '/embed/#state' },
      'The plugin UI entrypoint must stay on its registered origin.',
    ],
  ])('refuses a registration with %s', async (_, ui, message) => {
    discover({ ...plugin, ui: { ...plugin.ui, ...ui } });
    renderHost();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Plugin UI registration is invalid');
    expect(alert).toHaveTextContent(message);
    expect(screen.queryByTitle(plugin.display_name)).not.toBeInTheDocument();
  });

  it('admits a loopback HTTP plugin UI only in development builds', async () => {
    discover({ ...plugin, ui: { ...plugin.ui, origin: 'http://127.0.0.1:4300' } });
    const { unmount } = renderHost();
    expect(await screen.findByTitle(plugin.display_name)).toHaveAttribute(
      'src',
      'http://127.0.0.1:4300/embed/',
    );
    unmount();

    vi.stubEnv('DEV', false);
    renderHost();
    expect(await screen.findByRole('alert')).toHaveTextContent('Plugin UI origins must use HTTPS.');
    expect(screen.queryByTitle(plugin.display_name)).not.toBeInTheDocument();
  });

  it('shows the availability notice above a working frame when the organization has the plugin disabled', async () => {
    discover({ ...plugin, state: 'not_enabled', mode: 'safety_only' });
    renderHost();
    const frame = await screen.findByTitle(plugin.display_name);
    const notice = screen.getByRole('alert');
    expect(notice).toHaveTextContent('Progressive Rollouts: new work disabled');
    expect(notice.compareDocumentPosition(frame)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
