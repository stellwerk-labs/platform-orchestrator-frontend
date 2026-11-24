import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { server } from '@src/testing-utils/mswServer';

import { loadPlanLogs } from './planLogsApi';

const limit = 4 * 1024 * 1024;
let origin: string;
let respond: (request: IncomingMessage, response: ServerResponse) => void;
const fixture = createServer((request, response) => {
  response.setHeader('Connection', 'close');
  response.setHeader('X-Stellwerk-Plan-Subject', 'saved-plan');
  respond(request, response);
});
beforeAll(async () => {
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
  server.close();
});
beforeEach(() => {
  respond = (_request, response) => response.end('resource changes');
});
afterAll(async () => {
  server.listen();
  fixture.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    fixture.close((error) => (error ? reject(error) : resolve())),
  );
});
const load = (subject = 'saved-plan', signal = new AbortController().signal) =>
  loadPlanLogs(
    `${origin}/api/`,
    { orgId: 'org/one', projectId: 'project?two', envId: 'env' },
    'run/three',
    subject,
    signal,
  );

describe('pipeline plan log transport', () => {
  it('loads the exact subject with encoded scope and no decryption key', async () => {
    let received: IncomingMessage | undefined;
    respond = (request, response) => {
      received = request;
      response.end('resource changes');
    };
    await expect(load()).resolves.toBe('resource changes');
    expect(received?.url).toBe(
      '/api/orgs/org%2Fone/projects/project%3Ftwo/envs/env/runner-rollouts/run%2Fthree/plan-logs?subject=saved-plan',
    );
    expect(received?.headers.decryptkey).toBeUndefined();
    expect(received?.headers.accept).toBe('text/plain');
  });

  it.each([undefined, 'different-plan'])(
    'rejects a missing or different response subject before displaying its content: %s',
    async (subject) => {
      respond = (_request, response) => {
        response.removeHeader('X-Stellwerk-Plan-Subject');
        if (subject) response.setHeader('X-Stellwerk-Plan-Subject', subject);
        response.end('private wrong plan');
      };
      await expect(load()).rejects.toThrow('The plan changed.');
    },
  );

  it('accepts a failed-plan artifact with an explicitly empty subject', async () => {
    respond = (_request, response) => {
      response.setHeader('X-Stellwerk-Plan-Subject', '');
      response.end('Error: invalid configuration');
    };
    await expect(load('')).resolves.toBe('Error: invalid configuration');
  });

  it.each([
    [401, 'Your session expired.'],
    [403, 'You do not have permission'],
    [404, 'not captured for this older run'],
    [409, 'The plan changed.'],
    [413, 'exceeds the 4 MiB'],
    [503, 'Runner may be disconnected'],
  ])(
    'maps HTTP %i to safe text instead of rendering the response body',
    async (status, message) => {
      respond = (_request, response) => {
        response.writeHead(status);
        response.end('PRIVATE_BACKEND_ERROR');
      };
      await expect(load()).rejects.toThrow(message);
    },
  );

  it('reads the complete 4 MiB response and preserves multibyte text', async () => {
    respond = (_request, response) => {
      response.write('x'.repeat(limit - 3));
      response.end('€');
    };
    const content = await load();
    expect(new TextEncoder().encode(content)).toHaveLength(limit);
    expect(content.endsWith('€')).toBe(true);
  });

  it('rejects an oversized stream and closes it without returning a partial log', async () => {
    let closed = false;
    respond = (_request, response) => {
      response.once('close', () => {
        closed = true;
      });
      response.writeHead(200);
      response.write('x'.repeat(limit + 1));
    };
    await expect(load()).rejects.toThrow('exceeds the 4 MiB');
    await expect.poll(() => closed).toBe(true);
  });
});
