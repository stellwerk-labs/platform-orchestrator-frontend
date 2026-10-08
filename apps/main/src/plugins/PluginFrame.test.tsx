import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createContext, useContext } from 'react';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserPreferencesStore } from '@src/hooks/zustand/useUserPreferencesStore';
import { server } from '@src/testing-utils/mswServer';

import { PluginFrame } from './PluginFrame';
import type { PluginDescriptor } from './types';

// jsdom cannot load a cross-origin document, so each test plays the plugin
// frame itself: it reads what the host posts to the frame window, dispatches
// window messages with an explicit source and origin, and talks over the real
// MessagePort the host transfers in INIT.

const pluginOrigin = 'https://rollouts-ui.example.net';
const orgId = 'org-one';
const mountedAt = '/orgs/org-one/rollouts/history?tab=waves';
const nonceShape = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const invokeUrl = 'http://example.com/orgs/:orgId/plugins/:pluginId/invoke';
const materialUrl =
  'http://example.com/orgs/:orgId/plugins/:pluginId/projects/:projectUuid/envs/:environmentUuid/deployments/:deploymentId';
const material = {
  projectUuid: '0b6b3c58-63c4-4d5e-9b51-4c1a5d1f0a10',
  environmentUuid: '7d0f6a52-5f3e-4f63-a3a4-0d6c1b0c7e01',
  deploymentId: '3f1e9a4c-2b7d-4c8e-9f60-1a2b3c4d5e6f',
};

const plugin: PluginDescriptor = {
  id: 'dev.stellwerk.progressive-rollouts',
  display_name: 'Progressive Rollouts',
  state: 'available',
  mode: 'full',
  ui: {
    sdk_version: '1',
    origin: pluginOrigin,
    entrypoint: '/embed/',
    route_prefix: 'rollouts',
    navigation_label: 'Rollouts',
    core_operations: [
      { id: 'core.getPluginDeploymentLogs', method: 'GET', mutating: false },
      { id: 'core.getPluginDeploymentOutputs', method: 'GET', mutating: false },
      // Advertised by discovery, yet outside the Console's closed host dispatcher.
      { id: 'core.deleteOrganization', method: 'DELETE', mutating: true },
    ],
  },
  operations: [
    { id: 'listProgressiveRollouts', method: 'GET', mutating: false },
    { id: 'createProgressiveRollout', method: 'POST', mutating: true },
  ],
};

const LocationProbe = () => {
  const { pathname, search } = useLocation();
  return <output data-testid={'location'}>{`${pathname}${search}`}</output>;
};

const currentLocation = () => screen.getByTestId('location').textContent;

// The Console mounts plugins under a data router, whose navigate function stays
// stable across navigations. A declarative router hands out a new one per
// location, which would tear the bridge down on every navigation.
const Discovered = createContext(plugin);

const FrameRoute = () => (
  <>
    <PluginFrame orgId={orgId} plugin={useContext(Discovered)} />
    <LocationProbe />
  </>
);

const mountFrame = (descriptor: PluginDescriptor) => {
  const router = createMemoryRouter([{ path: '*', element: <FrameRoute /> }], {
    initialEntries: [mountedAt],
  });
  const withDescriptor = (current: PluginDescriptor) => (
    <Discovered.Provider value={current}>
      <RouterProvider router={router} />
    </Discovered.Provider>
  );
  const view = render(withDescriptor(descriptor));
  return { ...view, rediscover: (next: PluginDescriptor) => view.rerender(withDescriptor(next)) };
};

const renderFrame = (descriptor: PluginDescriptor = plugin) => {
  const view = mountFrame(descriptor);
  const iframe = screen.getByTitle<HTMLIFrameElement>(descriptor.display_name);
  const frameWindow = iframe.contentWindow!;
  const toFrame = vi.spyOn(frameWindow, 'postMessage').mockImplementation(() => undefined);
  return { ...view, iframe, frameWindow, toFrame };
};
type Frame = ReturnType<typeof renderFrame>;

const posted = (view: Frame) =>
  (view.toFrame.mock.calls as unknown[][]).map(([message, targetOrigin, transfer]) => ({
    message: message as Record<string, unknown>,
    targetOrigin,
    transfer,
  }));

const postedOfType = (view: Frame, type: string) =>
  posted(view).filter(({ message }) => message.type === type);

const lastOfType = (view: Frame, type: string) => postedOfType(view, type).slice(-1)[0]!;

const helloNonces = (view: Frame) =>
  new Set(postedOfType(view, 'stellwerk.host.hello').map(({ message }) => message.nonce));

const readyFor = (nonce: string) => ({ type: 'stellwerk.plugin.ready', sdk_version: '1', nonce });

const sendReady = (source: MessageEventSource | null, data: unknown, origin = pluginOrigin) =>
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { source, origin, data }));
  });

const openPorts: MessagePort[] = [];

const listen = (port: MessagePort) => {
  const received: Record<string, unknown>[] = [];
  port.onmessage = ({ data }) => received.push(data as Record<string, unknown>);
  openPorts.push(port);
  return received;
};

const closed = (port: MessagePort) =>
  new Promise<void>((resolve) => port.addEventListener('close', () => resolve()));

const load = (view: Frame) => {
  fireEvent.load(view.iframe);
  return lastOfType(view, 'stellwerk.host.hello').message.nonce as string;
};

const open = (view: Frame, nonce: string) => {
  sendReady(view.frameWindow, readyFor(nonce));
  const init = lastOfType(view, 'stellwerk.host.init');
  const port = (init.transfer as MessagePort[])[0]!;
  return { nonce, init, port, received: listen(port) };
};
type Session = ReturnType<typeof open>;

const connect = (view: Frame) => open(view, load(view));

const request = (session: Session, overrides: Record<string, unknown> = {}) => ({
  type: 'stellwerk.plugin.operation.request',
  sdk_version: '1',
  nonce: session.nonce,
  request_id: 'request-1',
  org_id: orgId,
  operation_id: 'listProgressiveRollouts',
  ...overrides,
});

const navigation = (session: Session, type: string, route: string) => ({
  type,
  sdk_version: '1',
  nonce: session.nonce,
  route,
});

const exchange = async (session: Session, message: unknown) => {
  const count = session.received.length;
  session.port.postMessage(message);
  await waitFor(() => expect(session.received).toHaveLength(count + 1));
  return session.received[count];
};

const readBlob = (blob: Blob) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsText(blob);
  });

const keysOf = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, item]) => [key, ...keysOf(item)]);
};

const coreRequests: string[] = [];

beforeEach(() => {
  useUserPreferencesStore.setState({ theme: 'light' });
  server.events.on('request:start', ({ request: outgoing }) => {
    coreRequests.push(`${outgoing.method} ${new URL(outgoing.url).pathname}`);
  });
});

afterEach(() => {
  server.events.removeAllListeners();
  coreRequests.length = 0;
  openPorts.splice(0).forEach((port) => port.close());
  document.documentElement.lang = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('plugin frame', () => {
  it('mounts the validated entrypoint in a sandboxed frame without referrer or feature grants', () => {
    const { iframe, toFrame } = renderFrame();
    expect(iframe).toHaveAttribute('src', `${pluginOrigin}/embed/`);
    expect(iframe).toHaveAttribute(
      'sandbox',
      'allow-scripts allow-forms allow-downloads allow-same-origin',
    );
    expect(iframe).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(iframe).not.toHaveAttribute('allow');
    expect(toFrame).not.toHaveBeenCalled();
  });

  it('greets the loaded frame with one fresh nonce for five seconds, then reports the failed handshake', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const view = renderFrame();
    const nonce = load(view);
    expect(nonce).toMatch(nonceShape);
    expect(posted(view)).toEqual([
      {
        message: { type: 'stellwerk.host.hello', sdk_version: '1', nonce },
        targetOrigin: pluginOrigin,
        transfer: undefined,
      },
    ]);
    act(() => vi.advanceTimersByTime(19 * 250));
    expect(postedOfType(view, 'stellwerk.host.hello')).toHaveLength(20);
    expect(helloNonces(view)).toEqual(new Set([nonce]));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(250));
    expect(screen.getByRole('alert')).toHaveTextContent('Plugin UI bridge failed');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'The plugin UI did not complete the bridge handshake.',
    );
    expect(screen.queryByTitle(plugin.display_name)).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(5000));
    expect(posted(view)).toHaveLength(20);
  });

  it('opens the bridge only for a READY from the frame window, plugin origin, current nonce and SDK', () => {
    const view = renderFrame();
    const nonce = load(view);
    const sibling = document.createElement('iframe');
    document.body.append(sibling);
    const refused: [MessageEventSource | null, unknown, string][] = [
      // Another window of the plugin origin, such as a nested frame or a popup.
      [sibling.contentWindow, readyFor(nonce), pluginOrigin],
      [window, readyFor(nonce), pluginOrigin],
      [null, readyFor(nonce), pluginOrigin],
      [view.frameWindow, readyFor(nonce), 'https://attacker.example.org'],
      [view.frameWindow, readyFor(nonce), window.location.origin],
      [view.frameWindow, readyFor('00000000-0000-4000-8000-000000000000'), pluginOrigin],
      [view.frameWindow, { ...readyFor(nonce), sdk_version: '2' }, pluginOrigin],
      [view.frameWindow, { ...readyFor(nonce), type: 'stellwerk.plugin.hello' }, pluginOrigin],
      [view.frameWindow, JSON.stringify(readyFor(nonce)), pluginOrigin],
    ];
    for (const [source, data, origin] of refused) sendReady(source, data, origin);
    sibling.remove();
    expect(postedOfType(view, 'stellwerk.host.init')).toHaveLength(0);

    sendReady(view.frameWindow, readyFor(nonce));
    expect(postedOfType(view, 'stellwerk.host.init')).toHaveLength(1);
  });

  it('transfers its own port in a single INIT, ignores a replayed READY and stops greeting', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    document.documentElement.lang = 'de-CH';
    const view = renderFrame();
    const nonce = load(view);
    const offered = new MessageChannel();
    openPorts.push(offered.port1, offered.port2);
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: view.frameWindow,
          origin: pluginOrigin,
          data: readyFor(nonce),
          ports: [offered.port1],
        }),
      );
    });
    sendReady(view.frameWindow, readyFor(nonce));
    act(() => vi.advanceTimersByTime(5000));

    const [hello, init, ...rest] = posted(view);
    expect(hello!.message.type).toBe('stellwerk.host.hello');
    expect(rest).toEqual([]);
    expect(init).toEqual({
      message: {
        type: 'stellwerk.host.init',
        sdk_version: '1',
        nonce,
        org_id: orgId,
        plugin_id: plugin.id,
        state: 'available',
        mode: 'full',
        route: '/history?tab=waves',
        theme: 'light',
        locale: 'de-CH',
        operations: [...plugin.operations, ...plugin.ui!.core_operations!],
      },
      targetOrigin: pluginOrigin,
      transfer: [expect.any(MessagePort)],
    });
    expect((init!.transfer as MessagePort[])[0]).not.toBe(offered.port1);
    openPorts.push((init!.transfer as MessagePort[])[0]!);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each<[string, (session: Session) => unknown, string | undefined, string]>([
    [
      'a message that is not an envelope',
      () => 'listProgressiveRollouts',
      undefined,
      'Malformed plugin bridge message.',
    ],
    [
      'an unknown nonce',
      (session) => request(session, { nonce: '00000000-0000-4000-8000-000000000000' }),
      'request-1',
      'Stale or incompatible plugin bridge session.',
    ],
    [
      'another SDK version',
      (session) => request(session, { sdk_version: '2' }),
      'request-1',
      'Stale or incompatible plugin bridge session.',
    ],
    [
      'an unknown message type',
      (session) => request(session, { type: 'stellwerk.plugin.fetch' }),
      'request-1',
      'Unknown plugin bridge message.',
    ],
    [
      'another organization',
      (session) => request(session, { org_id: 'org-two' }),
      'request-1',
      'Malformed or cross-organization operation request.',
    ],
    [
      'an empty request ID',
      (session) => request(session, { request_id: '' }),
      '',
      'Malformed or cross-organization operation request.',
    ],
    [
      'an unregistered plugin operation',
      (session) => request(session, { operation_id: 'dropAllRollouts' }),
      'request-1',
      'The requested operation is not registered.',
    ],
    [
      'an unadvertised Core operation',
      (session) => request(session, { operation_id: 'core.listProjects' }),
      'request-1',
      'The requested operation is not registered.',
    ],
    [
      'an advertised Core operation outside the host allowlist',
      (session) =>
        request(session, { operation_id: 'core.deleteOrganization', idempotency_key: 'once' }),
      'request-1',
      'The requested host operation is not allowlisted.',
    ],
    [
      'a mutation without an Idempotency Key',
      (session) =>
        request(session, { operation_id: 'createProgressiveRollout', body: { module: 'redis' } }),
      'request-1',
      'Mutating operations require an Idempotency Key.',
    ],
    [
      'an empty Idempotency Key',
      (session) => request(session, { idempotency_key: '' }),
      'request-1',
      'An Idempotency Key must be a non-empty string.',
    ],
    [
      'non-string path parameters',
      (session) => request(session, { path_parameters: { rolloutId: 7 } }),
      'request-1',
      'Operation path parameters must be strings.',
    ],
    [
      'query values that are not string arrays',
      (session) => request(session, { query: { state: 'Running' } }),
      'request-1',
      'Operation query parameters must be string arrays.',
    ],
    [
      'a body JSON cannot carry',
      (session) => request(session, { body: { count: 1n } }),
      'request-1',
      'Operation bodies must be JSON serializable.',
    ],
    [
      'plugin navigation to another host',
      (session) => navigation(session, 'stellwerk.plugin.navigate', '//attacker.example.org/x'),
      undefined,
      'Plugin navigation must use an absolute same-origin route.',
    ],
    [
      'Console navigation to an absolute URL',
      (session) =>
        navigation(session, 'stellwerk.plugin.navigate-core', 'https://attacker.example.org/x'),
      undefined,
      'Plugin navigation must use an absolute same-origin route.',
    ],
  ])('answers %s with an error and calls nothing', async (_, message, requestId, error) => {
    const session = connect(renderFrame());
    expect(await exchange(session, message(session))).toEqual({
      type: 'stellwerk.host.operation.response',
      sdk_version: '1',
      nonce: session.nonce,
      request_id: requestId,
      error,
    });
    expect(coreRequests).toEqual([]);
    expect(currentLocation()).toBe(mountedAt);
  });

  it('sends an advertised operation to Core once as the fixed invoke envelope and relays the answer', async () => {
    const invocations: unknown[] = [];
    server.use(
      http.post(invokeUrl, async ({ params, request: invoke }) => {
        invocations.push({ params, body: await invoke.json() });
        return HttpResponse.json({ status: 201, body: { id: 'rollout-1' } });
      }),
    );
    const session = connect(renderFrame());
    const answer = await exchange(
      session,
      request(session, {
        request_id: 'create-1',
        operation_id: 'createProgressiveRollout',
        path_parameters: { moduleId: 'redis' },
        query: { wave: ['canary', 'all'] },
        body: { version: '1.2.0' },
        idempotency_key: 'create-once',
        url: 'https://attacker.example.org/steal',
        method: 'DELETE',
      }),
    );
    expect(answer).toEqual({
      type: 'stellwerk.host.operation.response',
      sdk_version: '1',
      nonce: session.nonce,
      request_id: 'create-1',
      response: { status: 201, body: { id: 'rollout-1' } },
    });
    expect(invocations).toEqual([
      {
        params: { orgId, pluginId: plugin.id },
        body: {
          operation_id: 'createProgressiveRollout',
          path_parameters: { moduleId: 'redis' },
          query: { wave: ['canary', 'all'] },
          body: { version: '1.2.0' },
          idempotency_key: 'create-once',
        },
      },
    ]);
    expect(coreRequests).toEqual([`POST /orgs/${orgId}/plugins/${plugin.id}/invoke`]);
  });

  it('relays a Core refusal to the frame as an error', async () => {
    server.use(
      http.post(invokeUrl, () =>
        HttpResponse.json({ code: 'plugin_not_enabled' }, { status: 409 }),
      ),
    );
    const session = connect(renderFrame());
    expect(await exchange(session, request(session))).toEqual({
      type: 'stellwerk.host.operation.response',
      sdk_version: '1',
      nonce: session.nonce,
      request_id: 'request-1',
      error: 'Request failed with status code 409',
    });
  });

  it('routes plugin navigation through the Console router and keeps it inside the organization', async () => {
    const session = connect(renderFrame());
    session.port.postMessage(navigation(session, 'stellwerk.plugin.navigate', '/new?module=redis'));
    await waitFor(() => expect(currentLocation()).toBe('/orgs/org-one/rollouts/new?module=redis'));
    await waitFor(() =>
      expect(session.received).toEqual([
        {
          type: 'stellwerk.host.route',
          sdk_version: '1',
          nonce: session.nonce,
          route: '/new?module=redis',
        },
      ]),
    );

    session.port.postMessage(navigation(session, 'stellwerk.plugin.navigate', '/../../../members'));
    await waitFor(() => expect(currentLocation()).toBe('/orgs/org-one/rollouts/members'));

    session.port.postMessage(
      navigation(session, 'stellwerk.plugin.navigate-core', '/../../modules/redis?tab=versions'),
    );
    await waitFor(() => expect(currentLocation()).toBe('/orgs/org-one/modules/redis?tab=versions'));
    expect(coreRequests).toEqual([]);
  });

  it('pushes theme changes to the connected frame with the current nonce', async () => {
    const session = connect(renderFrame());
    act(() => useUserPreferencesStore.setState({ theme: 'dark' }));
    await waitFor(() =>
      expect(session.received).toEqual([
        { type: 'stellwerk.host.theme', sdk_version: '1', nonce: session.nonce, theme: 'dark' },
      ]),
    );
  });

  it('closes the previous port and rotates the nonce when the frame loads another document', async () => {
    const view = renderFrame();
    const first = connect(view);
    const firstClosed = closed(first.port);

    const nonce = load(view);
    await firstClosed;
    expect(nonce).toMatch(nonceShape);
    expect(nonce).not.toBe(first.nonce);
    sendReady(view.frameWindow, readyFor(first.nonce));
    expect(postedOfType(view, 'stellwerk.host.init')).toHaveLength(1);

    const second = open(view, nonce);
    expect(postedOfType(view, 'stellwerk.host.init')).toHaveLength(2);
    expect(second.port).not.toBe(first.port);
    expect(await exchange(second, request(second, { nonce: first.nonce }))).toEqual({
      type: 'stellwerk.host.operation.response',
      sdk_version: '1',
      nonce,
      request_id: 'request-1',
      error: 'Stale or incompatible plugin bridge session.',
    });
    expect(first.received).toEqual([]);
  });

  it('restarts the handshake when discovery changes the descriptor', async () => {
    const view = renderFrame();
    const first = connect(view);
    view.rediscover({ ...plugin, ui: { ...plugin.ui! } });
    expect(helloNonces(view)).toEqual(new Set([first.nonce]));

    const firstClosed = closed(first.port);
    view.rediscover({ ...plugin, state: 'not_enabled', mode: 'safety_only' });
    await firstClosed;
    const [, nonce] = helloNonces(view);
    expect(nonce).toMatch(nonceShape);
    const second = open(view, nonce as string);
    expect(second.init.message).toMatchObject({ nonce, state: 'not_enabled', mode: 'safety_only' });
  });

  it('stops greeting and listening once it unmounts', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const view = renderFrame();
    const nonce = load(view);
    view.unmount();
    act(() => vi.advanceTimersByTime(5000));
    sendReady(view.frameWindow, readyFor(nonce));
    expect(posted(view)).toHaveLength(1);
  });

  it('closes the bridge port when it unmounts', async () => {
    const view = renderFrame();
    const session = connect(view);
    const sessionClosed = closed(session.port);
    view.unmount();
    await sessionClosed;
  });

  it('renders nothing for a hidden plugin', () => {
    mountFrame({ ...plugin, state: 'unavailable', mode: 'hidden' });
    expect(screen.queryByTitle(plugin.display_name)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('refuses to mount a plugin without a UI contribution', () => {
    mountFrame({ ...plugin, ui: undefined });
    expect(screen.getByText('The plugin has no registered UI contribution.')).toBeInTheDocument();
    expect(screen.queryByTitle(plugin.display_name)).not.toBeInTheDocument();
  });

  it('shows Deployment logs in a Console dialog and answers the frame with an empty completion', async () => {
    const logs = 'wave canary: applied\nwave all: applied';
    server.use(http.get(`${materialUrl}/logs`, () => HttpResponse.text(logs)));
    const session = connect(renderFrame());
    const answer = await exchange(
      session,
      request(session, {
        request_id: 'logs-1',
        operation_id: 'core.getPluginDeploymentLogs',
        path_parameters: material,
      }),
    );
    expect(answer).toEqual({
      type: 'stellwerk.host.operation.response',
      sdk_version: '1',
      nonce: session.nonce,
      request_id: 'logs-1',
      response: { status: 204, body: null },
    });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(`Deployment ${material.deploymentId} logs`);
    expect(dialog).toHaveTextContent('wave all: applied');
    expect(coreRequests).toEqual([
      `GET /orgs/${orgId}/plugins/${plugin.id}/projects/${material.projectUuid}/envs/${material.environmentUuid}/deployments/${material.deploymentId}/logs`,
    ]);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByText(/wave all: applied/)).not.toBeInTheDocument());
  });

  it('downloads Deployment outputs through a revoked blob URL and never hands them to the frame', async () => {
    const outputs = 'endpoint = "https://payments.example.net"';
    server.use(http.get(`${materialUrl}/outputs`, () => HttpResponse.text(outputs)));
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL');
    // jsdom cannot follow a download; the anchor the host clicked is what matters.
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const session = connect(renderFrame());
    const answer = await exchange(
      session,
      request(session, {
        request_id: 'outputs-1',
        operation_id: 'core.getPluginDeploymentOutputs',
        path_parameters: material,
      }),
    );
    expect(answer).toMatchObject({
      request_id: 'outputs-1',
      response: { status: 204, body: null },
    });

    const blobUrl = createObjectUrl.mock.results[0]!.value as string;
    await expect(readBlob(createObjectUrl.mock.calls[0]![0] as Blob)).resolves.toBe(outputs);
    const [anchor] = click.mock.contexts as HTMLAnchorElement[];
    expect(anchor).toHaveAttribute('href', blobUrl);
    expect(anchor).toHaveAttribute('download', `deployment-${material.deploymentId}-outputs.txt`);
    expect(anchor).not.toBeInTheDocument();
    await waitFor(() => expect(revokeObjectUrl).toHaveBeenCalledWith(blobUrl));
    expect(JSON.stringify(session.received)).not.toContain('payments.example.net');
  });

  it('never puts the session cookie or a credential into a bridge message', async () => {
    const sessionValue = 'session-value-under-test';
    document.cookie = `session-token=${sessionValue}; path=/`;
    expect(document.cookie).toContain(sessionValue);
    server.use(http.post(invokeUrl, () => HttpResponse.json({ status: 200, body: { items: [] } })));
    const view = renderFrame();
    const session = connect(view);
    await exchange(session, request(session));
    await exchange(session, request(session, { operation_id: 'dropAllRollouts' }));
    act(() => useUserPreferencesStore.setState({ theme: 'dark' }));
    await waitFor(() => expect(session.received).toHaveLength(3));

    const messages = [...posted(view).map(({ message }) => message), ...session.received];
    expect(JSON.stringify(messages)).not.toContain(sessionValue);
    expect(
      keysOf(messages).filter((key) => /token|authorization|cookie|session|secret/i.test(key)),
    ).toEqual([]);
    document.cookie = 'session-token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });
});
