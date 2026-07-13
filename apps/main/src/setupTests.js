import resizeoberver from 'resize-observer-polyfill';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import '@testing-library/jest-dom';
import 'react-app-polyfill/stable';

import { server } from './testing-utils/mswServer';

// window.matchMedia mock
window.matchMedia = vi.fn().mockImplementation((query) => {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
});

Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    getPropertyValue: () => {
      return '';
    },
  }),
});

// setupTests.ts
Object.defineProperty(global.Image.prototype, 'decode', {
  value: () => Promise.resolve(),
});

vi.mock('react-intersection-observer');

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// mutation observer polyfill
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('mutationobserver-shim');

global.MutationObserver = global.window.MutationObserver;
global.ResizeObserver = resizeoberver;

// This avoids JSDOM from making CORS/preflight requests unnecessarily and returning 501 errors
global.XMLHttpRequest = undefined;
