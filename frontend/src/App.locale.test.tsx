import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { awaitingOrder } from './features/buyer/buyerLocaleFixtures';
import { LOCALE_STORAGE_KEY } from './features/locale';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  vi.restoreAllMocks();
});

function button(name: string): HTMLButtonElement {
  const match = Array.from(container.querySelectorAll('button'))
    .find((candidate) => candidate.textContent === name);
  if (!match) throw new Error(`Missing button ${name}`);
  return match;
}

describe('Both application entry paths expose the language switch', () => {
  it('switches the signed-out/no-Clerk seller path and keeps unmigrated screens working', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: 'healthy', project_name: 'Test', environment: 'test',
      database_configured: false, gemini_configured: false,
    })));

    await act(async () => root.render(<App />));

    expect(container.querySelector('.locale-switch')).not.toBeNull();
    expect(button('বাংলা')).toBeDefined();
    expect(button('English')).toBeDefined();
    expect(container.textContent).toContain('Sign in to your shop');

    await act(async () => button('বাংলা').click());

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('bn');
    expect(document.documentElement.lang).toBe('bn-BD');
    expect(container.textContent).toContain('Sign in to your shop');
  });

  it('uses the saved device preference for a shared buyer link without extra requests', async () => {
    window.history.replaceState({}, '', '/orders/shared-token');
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'bn');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(awaitingOrder)));

    await act(async () => root.render(<App />));

    expect(container.textContent).toContain('অর্ডার নিশ্চিতকরণ');
    expect(container.textContent).toContain('হোমে ফিরুন');
    expect(container.textContent).toContain('ডেলিভারির আগে অগ্রিম');
    expect(container.textContent).toContain('01712345678');
    const orderReads = () => fetchMock.mock.calls
      .filter(([url]) => url === '/api/public/orders/shared-token').length;
    expect(orderReads()).toBe(1);

    await act(async () => button('English').click());

    expect(container.textContent).toContain('Back to Home');
    expect(container.textContent).toContain('Delivery advance');
    expect(document.documentElement.lang).toBe('en');
    expect(orderReads()).toBe(1);
  });
});
