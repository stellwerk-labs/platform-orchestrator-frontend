import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { windowEnv } from '@src/config/environment';
import { server } from '@src/testing-utils/mswServer';

import { PipelinePlanLogs } from './PipelinePlanLogs';

const scope = { orgId: 'org', projectId: 'project', envId: 'env' };
const content = 'terraform_data.marker will be updated <img src=x onerror=alert(1)>';
const originalBaseURL = windowEnv.BASE_URL;
let respond: (request: IncomingMessage, response: ServerResponse) => void;
let requests = 0;
const fixture = createServer((request, response) => {
  requests++;
  response.setHeader('Connection', 'close');
  response.setHeader('X-Stellwerk-Plan-Subject', 'saved-plan');
  respond(request, response);
});
beforeAll(async () => {
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  windowEnv.BASE_URL = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
  server.close();
});
beforeEach(() => {
  requests = 0;
  respond = (_request, response) => response.end(content);
});
afterAll(async () => {
  windowEnv.BASE_URL = originalBaseURL;
  server.listen();
  fixture.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    fixture.close((error) => (error ? reject(error) : resolve())),
  );
});

const view = (canRead = true, id = 'run') => (
  <PipelinePlanLogs scope={scope} id={id} subject={'saved-plan'} canRead={canRead} />
);
const pendingStream = () => {
  let closed = false;
  let finish!: () => void;
  respond = (_request, response) => {
    response.once('close', () => {
      closed = true;
    });
    response.writeHead(200);
    response.write('pending private plan');
    finish = () => response.end('late private plan');
  };
  return { closed: () => closed, finish: () => finish() };
};

describe('pipeline plan log viewer', () => {
  it('loads inline, masks its contents and shares the deployment log controls', async () => {
    render(view());
    const logs = await screen.findByLabelText('Runner logs');
    expect(logs).toHaveTextContent(content);
    expect(within(logs).queryByRole('img')).not.toBeInTheDocument();
    const privacy = logs.closest('.amp-block');
    expect(privacy).toHaveAttribute('data-amp-mask');
    expect(privacy).toHaveAttribute('data-dd-privacy', 'hidden');
    await userEvent.click(screen.getByRole('button', { name: 'Show raw logs' }));
    expect(logs.textContent).toBe(content);
    await userEvent.click(screen.getByRole('button', { name: 'Clear logs' }));
    expect(screen.queryByLabelText('Runner logs')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reload logs' }));
    expect(await screen.findByLabelText('Runner logs')).toHaveTextContent(content);
    expect(requests).toBe(2);
  });

  it('does not fetch without the dedicated log permission', () => {
    render(view(false));
    expect(
      screen.getByText('Deployment log permission is required to read plan logs.'),
    ).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it('clears previous plaintext when run or subject identity changes', async () => {
    const { rerender } = render(view());
    await screen.findByLabelText('Runner logs');
    rerender(view(true, 'another-run'));
    expect(screen.queryByLabelText('Runner logs')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Runner logs')).toHaveTextContent(content);
    expect(requests).toBe(2);
  });

  it('aborts a cleared stream and ignores its late response', async () => {
    const pending = pendingStream();
    render(view());
    await waitFor(() => expect(requests).toBe(1));
    await userEvent.click(screen.getByRole('button', { name: 'Clear logs' }));
    await waitFor(() => expect(pending.closed()).toBe(true));
    pending.finish();
    expect(screen.queryByLabelText('Runner logs')).not.toBeInTheDocument();
  });

  it('removes private data and aborts in-flight work when permission is revoked', async () => {
    const pending = pendingStream();
    const { rerender } = render(view());
    await waitFor(() => expect(requests).toBe(1));
    rerender(view(false));
    await waitFor(() => expect(pending.closed()).toBe(true));
    pending.finish();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Runner logs')).not.toBeInTheDocument();
    expect(
      screen.getByText('Deployment log permission is required to read plan logs.'),
    ).toBeInTheDocument();
  });
});

it('reads Native inherited Plan bytes through the ordinary Deployment route with exact capture authority', async () => {
  let address: URL | undefined;
  respond = (request, response) => {
    address = new URL(request.url ?? '/', windowEnv.BASE_URL);
    response.end('');
  };
  render(
    <PipelinePlanLogs
      scope={scope}
      id={'child'}
      subject={'child-subject'}
      canRead
      nativeSelection={{ executionId: 'source-plan', captureRevision: 7 }}
    />,
  );
  await screen.findByText('This run returned an empty plan log.');
  expect(address?.pathname).toBe('/orgs/org/deployments/child/actions/get-logs');
  expect(Object.fromEntries(address?.searchParams ?? [])).toEqual({
    decrypt: 'true',
    phase: 'plan',
    execution_id: 'source-plan',
    capture_revision: '7',
    subject: 'child-subject',
  });
  expect(screen.getByText(/retained encrypted artifact/)).toBeVisible();
});
