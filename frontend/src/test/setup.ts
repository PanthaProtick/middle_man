import { afterEach, beforeEach, vi } from 'vitest';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Node 25 exposes an experimental `localStorage` global that shadows the
 * happy-dom Storage in this harness but has no usable methods without a
 * --localstorage-file path. Install a small in-memory Storage only when the
 * environment's implementation is unusable.
 */
function installUsableLocalStorage(): void {
  if (typeof window === 'undefined') return;
  const current = window.localStorage as Partial<Storage> | undefined;
  if (typeof current?.getItem === 'function' && typeof current.setItem === 'function'
    && typeof current.removeItem === 'function' && typeof current.clear === 'function') return;

  const data = new Map<string, string>();
  const memory: Storage = {
    get length() { return data.size; },
    clear() { data.clear(); },
    getItem(key: string) { return data.get(key) ?? null; },
    key(index: number) { return [...data.keys()][index] ?? null; },
    removeItem(key: string) { data.delete(key); },
    setItem(key: string, value: string) { data.set(String(key), String(value)); },
  };
  Object.defineProperty(window, 'localStorage', { value: memory, configurable: true, writable: true });
}

installUsableLocalStorage();

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
