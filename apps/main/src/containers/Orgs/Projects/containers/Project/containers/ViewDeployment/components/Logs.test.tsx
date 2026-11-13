import { File as NativeFile } from 'node:buffer';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { windowEnv } from '@src/config/environment';
import { getCheckPermissionsQueryKey } from '@src/hooks/react-query/v2/iam/user/user';
import { RBACPermission } from '@src/hooks/useRBAC';
import { server } from '@src/testing-utils/mswServer';

import { maximumLogKeyFileBytes } from './deploymentLogsApi';
import { Logs } from './Logs';

const fakeKey = 'AGE-SECRET-KEY-1SYNTHETICTESTONLY';
const firstLog = 'deployment completed <img src=x onerror=alert(1)>';
let origin: string;
let respond: (request: IncomingMessage, response: ServerResponse) => void;
let requests = 0;
let clients: QueryClient[] = [];
const originalBaseURL = windowEnv.BASE_URL;
const fixture = createServer((request, response) => {
  response.setHeader('Connection', 'close');
  requests += 1;
  respond(request, response);
});

beforeAll(async () => {
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
  // MSW tees response bodies; bypass it to exercise native stream cancellation.
  server.close();
  windowEnv.BASE_URL = origin;
});
beforeEach(() => {
  requests = 0;
  respond = (_request, response) => response.end(firstLog);
});
afterEach(() => {
  clients.forEach((client) => client.clear());
  clients = [];
});
afterAll(async () => {
  windowEnv.BASE_URL = originalBaseURL;
  server.listen();
  await new Promise<void>((resolve, reject) =>
    fixture.close((error) => (error ? reject(error) : resolve())),
  );
});

const renderLogs = (allowed = true) => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  clients.push(client);
  for (const orgId of ['atlas', 'second-org']) {
    const permission_check = {
      resource: `organization:${orgId}`,
      permission: RBACPermission.DEPLOYMENT_READ,
    };
    client.setQueryData(getCheckPermissionsQueryKey([permission_check]), {
      items: [{ permission_check, allowed }],
    });
  }
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/orgs/atlas/deployments/first/logs']}>
        <Link to={'/orgs/second-org/deployments/second/logs'}>Next deployment</Link>
        <Routes>
          <Route path={'/orgs/:orgId/deployments/:deployId/logs'} element={<Logs />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, client };
};

const submitKey = async (key = fakeKey) => {
  await userEvent.clear(screen.getByLabelText('Log decryption key'));
  await userEvent.type(screen.getByLabelText('Log decryption key'), key);
  await userEvent.click(screen.getByRole('button', { name: 'Load logs' }));
};

const openPendingStream = () => {
  let closed = false;
  let finish!: () => void;
  respond = (_request, response) => {
    response.once('close', () => {
      closed = true;
    });
    response.writeHead(200, { 'Content-Type': 'text/plain' });
    response.write('pending private content');
    finish = () => response.end('late result');
  };
  return { isClosed: () => closed, finish: () => finish() };
};

describe('Deployment Logs', () => {
  it('clears a submitted key immediately, renders log text inertly, and keeps plaintext out of the query cache', async () => {
    const { client } = renderLogs();
    await submitKey();
    expect(screen.getByLabelText('Log decryption key')).toHaveValue('');
    expect(await screen.findByText(firstLog)).toBeVisible();
    expect(within(screen.getByLabelText('Runner logs')).queryByRole('img')).not.toBeInTheDocument();
    const privacy = screen.getByLabelText('Log decryption key').closest('.amp-block');
    expect(privacy).toHaveAttribute('data-amp-mask');
    expect(privacy).toHaveAttribute('data-dd-privacy', 'hidden');
    const cached = JSON.stringify(
      client
        .getQueryCache()
        .getAll()
        .map((query) => query.state),
    );
    expect(cached).not.toContain(fakeKey);
    expect(cached).not.toContain(firstLog);
    expect(window.location.href).not.toContain(fakeKey);

    await userEvent.type(screen.getByLabelText('Log decryption key'), fakeKey);
    await userEvent.click(screen.getByRole('button', { name: 'Clear logs and key' }));
    expect(screen.getByLabelText('Log decryption key')).toHaveValue('');
    expect(screen.queryByText(firstLog)).not.toBeInTheDocument();
  });

  it('clears a rejected key and shows a fixed error without reflecting the response body', async () => {
    respond = (_request, response) => {
      response.writeHead(400);
      response.end(`backend failure: ${fakeKey}`);
    };
    renderLogs();
    await submitKey();
    expect(screen.getByLabelText('Log decryption key')).toHaveValue('');
    expect(
      await screen.findByText('The key is invalid or cannot decrypt this deployment’s logs.'),
    ).toBeVisible();
    expect(screen.queryByText(`backend failure: ${fakeKey}`)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load logs' })).toBeDisabled();
  });

  it('clears invalid local input without making an HTTP request', async () => {
    renderLogs();
    await submitKey('not-an-age-key');
    expect(
      await screen.findByText('Provide exactly one age secret key, or a key file containing it.'),
    ).toBeVisible();
    expect(screen.getByLabelText('Log decryption key')).toHaveValue('');
    expect(requests).toBe(0);
  });

  it('imports a real age key file, clears its selection, and removes the previous plaintext', async () => {
    renderLogs();
    await submitKey();
    await screen.findByText(firstLog);
    const fileInput = screen.getByLabelText('Load key file');
    const file = new NativeFile([`# test fixture\n${fakeKey}\n`], 'synthetic-age-key.txt');
    await userEvent.upload(fileInput, file as unknown as File);
    expect(screen.queryByText(firstLog)).not.toBeInTheDocument();
    expect(fileInput).toHaveValue('');
    await waitFor(() => expect(screen.getByLabelText('Log decryption key')).toHaveValue(fakeKey));
    await submitKey();
    expect(screen.getByLabelText('Log decryption key')).toHaveValue('');
    await screen.findByText(firstLog);
  });

  it.each([
    new NativeFile(['invalid key'], 'invalid.txt'),
    new NativeFile(['x'.repeat(maximumLogKeyFileBytes + 1)], 'oversized.txt'),
  ])('clears invalid or oversized file input without requesting logs (%#)', async (file) => {
    renderLogs();
    const fileInput = screen.getByLabelText('Load key file');
    await userEvent.upload(fileInput, file as unknown as File);
    expect(
      await screen.findByText(
        'Choose a key file up to 4 KiB containing exactly one age secret key.',
      ),
    ).toBeVisible();
    expect(fileInput).toHaveValue('');
    expect(screen.getByLabelText('Log decryption key')).toHaveValue('');
    expect(requests).toBe(0);
  });

  it('aborts a pending request when cleared and ignores its late result', async () => {
    const pending = openPendingStream();
    renderLogs();
    await submitKey();
    await waitFor(() => expect(requests).toBe(1));
    await userEvent.click(screen.getByRole('button', { name: 'Clear logs and key' }));
    await waitFor(() => expect(pending.isClosed()).toBe(true));
    pending.finish();
    expect(screen.queryByLabelText('Runner logs')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Log decryption key')).toHaveValue('');
  });

  it('removes decrypted content and key when organization and deployment change', async () => {
    renderLogs();
    await submitKey();
    await screen.findByText(firstLog);
    await userEvent.type(screen.getByLabelText('Log decryption key'), fakeKey);
    await userEvent.click(screen.getByRole('link', { name: 'Next deployment' }));
    expect(screen.queryByText(firstLog)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Log decryption key')).toHaveValue('');
    expect(requests).toBe(1);
  });

  it.each(['route', 'unmount'])('aborts a pending stream on %s', async (action) => {
    const pending = openPendingStream();
    const { unmount } = renderLogs();
    await submitKey();
    await waitFor(() => expect(requests).toBe(1));
    if (action === 'route')
      await userEvent.click(screen.getByRole('link', { name: 'Next deployment' }));
    else unmount();
    await waitFor(() => expect(pending.isClosed()).toBe(true));
    pending.finish();
    expect(screen.queryByLabelText('Runner logs')).not.toBeInTheDocument();
  });

  it('shows a denial without mounting the key form or requesting logs', () => {
    renderLogs(false);
    expect(
      screen.getByText('You do not have permission to read these deployment logs.'),
    ).toBeVisible();
    expect(screen.queryByLabelText('Log decryption key')).not.toBeInTheDocument();
    expect(requests).toBe(0);
  });
});
