import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { http, passthrough } from 'msw';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { server } from '@src/testing-utils/mswServer';

import { loadDeploymentLogs, maximumLogKeyFileBytes, parseLogKey } from './deploymentLogsApi';

const fakeKey = 'AGE-SECRET-KEY-1SYNTHETICTESTONLY';
const limit = 4 * 1024 * 1024;
let origin: string;
let respond: (request: IncomingMessage, response: ServerResponse) => void;
const fixture = createServer((request, response) => {
  response.setHeader('Connection', 'close');
  respond(request, response);
});

beforeAll(async () => {
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
  // MSW tees response bodies; bypass it to exercise native stream cancellation.
  server.close();
});
beforeEach(() => {
  respond = (_request, response) => response.end('deployment completed');
});
afterAll(async () => {
  server.listen();
  fixture.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    fixture.close((error) => (error ? reject(error) : resolve())),
  );
});

const load = (signal = new AbortController().signal) =>
  loadDeploymentLogs(`${origin}/api/`, 'org/one', 'deployment?two', fakeKey, signal);

describe('age log key parsing', () => {
  it('accepts a normal age-keygen file with comments, blank lines and CRLF', () => {
    expect(
      parseLogKey(`# created: test fixture\r\n# public key: test\r\n\r\n ${fakeKey} \r\n`),
    ).toBe(fakeKey);
  });

  it.each([
    '',
    '# comment only',
    'not-a-key',
    `${fakeKey}\n${fakeKey}`,
    `${fakeKey}\nextra`,
    '#'.repeat(maximumLogKeyFileBytes + 1),
  ])('rejects invalid, multiple or oversized input without echoing it (%#)', (input) => {
    expect(() => parseLogKey(input)).toThrow(
      'Provide exactly one age secret key, or a key file containing it.',
    );
  });
});

describe('deployment log HTTP transport', () => {
  it('sends the key only as a header and preserves the API prefix and encoded route segments', async () => {
    let received: IncomingMessage | undefined;
    let observed: Request | undefined;
    const observe = ({ request }: { request: Request }) => {
      if (request.url.startsWith(origin)) observed = request;
    };
    // Observe request policy without replacing the native HTTP fixture.
    server.listen();
    server.use(http.all(`${origin}/*`, () => passthrough()));
    server.events.on('request:start', observe);
    respond = (request, response) => {
      received = request;
      response.end('deployment completed');
    };
    try {
      await expect(load()).resolves.toBe('deployment completed');
      expect(received?.url).toBe(
        '/api/orgs/org%2Fone/deployments/deployment%3Ftwo/actions/get-logs',
      );
      expect(received?.headers.decryptkey).toBe(fakeKey);
      expect(received?.headers.accept).toBe('text/plain');
      expect(received?.url).not.toContain(fakeKey);
      expect(observed).toMatchObject({
        credentials: 'include',
        redirect: 'error',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
    } finally {
      server.events.removeListener('request:start', observe);
      server.close();
    }
  });

  it.each([
    [400, 'The key is invalid or cannot decrypt this deployment’s logs.'],
    [401, 'Your session expired. Sign in again to read the logs.'],
    [403, 'You do not have permission to read these deployment logs.'],
    [
      404,
      'Logs are not available. They may still be uploading, may not have been stored, or may have expired after 30 days.',
    ],
    [500, 'The logs could not be loaded. Try again.'],
  ])(
    'maps HTTP %i to a fixed message without exposing the server body',
    async (status, message) => {
      respond = (_request, response) => {
        response.writeHead(status);
        response.end(`private backend error containing ${fakeKey}`);
      };
      await expect(load()).rejects.toThrow(message);
    },
  );

  it.each([limit - 1, limit])('accepts all %i bytes without truncation', async (bytes) => {
    respond = (_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.write('x'.repeat(bytes - 3));
      response.end('€');
    };
    const content = await load();
    expect(new TextEncoder().encode(content)).toHaveLength(bytes);
    expect(content.endsWith('€')).toBe(true);
  });

  it('rejects a chunked response above 4 MiB and closes its body', async () => {
    let closed = false;
    respond = (_request, response) => {
      response.once('close', () => {
        closed = true;
      });
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.write('x'.repeat(limit + 1));
      // Keep the real stream open so cancellation, rather than EOF, must close it.
    };
    await expect(load()).rejects.toThrow(
      'This log exceeds the 4 MiB viewer limit. Download it with octl logs instead.',
    );
    await expect.poll(() => closed).toBe(true);
  });

  it('rejects redirects without sending a secret to the redirect target', async () => {
    let targetRequests = 0;
    respond = (request, response) => {
      if (request.url === '/redirect-target') {
        targetRequests += 1;
        response.end('unexpected');
      } else {
        response.writeHead(302, { Location: '/redirect-target' });
        response.end();
      }
    };
    await expect(load()).rejects.toThrow(
      'The log request was interrupted or could not reach the Orchestrator. Try again.',
    );
    expect(targetRequests).toBe(0);
  });

  it('aborts an in-progress stream and exposes only a fixed error', async () => {
    let started!: () => void;
    const streamStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    let closed = false;
    respond = (_request, response) => {
      response.once('close', () => {
        closed = true;
      });
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.write('partial log');
      started();
    };
    const controller = new AbortController();
    const pending = load(controller.signal);
    const failure = expect(pending).rejects.toThrow(
      'The log request was interrupted or could not reach the Orchestrator. Try again.',
    );
    await streamStarted;
    controller.abort();
    await failure;
    await expect.poll(() => closed).toBe(true);
  });
});
