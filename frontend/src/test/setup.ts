import { afterEach, beforeEach, vi } from 'vitest';

// Every test opts into its own response; unexpected HTTP must fail immediately.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => {
    throw new Error('Unexpected network request in a unit test. Mock fetch explicitly.');
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
