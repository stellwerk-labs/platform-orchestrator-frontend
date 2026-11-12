import { describe, expect, it } from 'vitest';

import { type BrowserSession, sessionDeadline } from './browserSession';

const session: BrowserSession = {
  user_id: 'user',
  idle_timeout_ms: 900_000,
  server_time: '2026-11-11T12:00:00Z',
  expires_at: '2026-11-11T12:15:00Z',
};

describe('browser session deadline', () => {
  it('uses the server remaining lifetime and the request start, excluding network latency', () => {
    expect(sessionDeadline(session, 1000)).toBe(901000);
  });
  it('rejects expired, boundary and malformed server deadlines', () => {
    for (const expires_at of [session.server_time, '2026-11-11T11:59:59Z', 'invalid']) {
      expect(() => sessionDeadline({ ...session, expires_at }, 1000)).toThrow('Session expired');
    }
  });
});
