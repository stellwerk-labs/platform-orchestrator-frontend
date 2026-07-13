import axios from 'axios';
import { describe, expect, it, vi } from 'vitest';

import { makeRequest } from './make-request';

vi.mock('axios');

describe('makeRequest', () => {
  it('should not send `withCredentials` when the URL is absolute', async () => {
    const spy = vi.spyOn(axios, 'request');
    await makeRequest('POST', 'https://example.com/api/', undefined, true);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ withCredentials: false }));
  });

  it('should send `withCredentials` when the URL is absolute', async () => {
    const spy = vi.spyOn(axios, 'request');
    await makeRequest('POST', '/relative/api');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ withCredentials: true }));
  });
});
