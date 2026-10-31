import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { LocaleProvider, LocaleSwitch, LOCALE_STORAGE_KEY } from '../locale';
import { SellerWorkspace } from './SellerWorkspace';
import { ShopMetricsBar } from './ShopMetricsBar';

it('switches setup language without losing the shop name or repeating requests', async () => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ shop: null, setup_needed: true })));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<LocaleProvider><LocaleSwitch /><SellerWorkspace token="token" /></LocaleProvider>));
    const input = container.querySelector<HTMLInputElement>('#shop-display-name')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'My Shop'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    const calls = fetcher.mock.calls.length;
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'বাংলা')!.click());
    expect(container.textContent).toContain('দোকান সেটআপ');
    expect(input.value).toBe('My Shop');
    expect(fetcher).toHaveBeenCalledTimes(calls);
  } finally { await act(async () => root.unmount()); container.remove(); fetcher.mockRestore(); localStorage.clear(); }
});

it('translates a failed setup without replaying it or exposing server text', async () => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => init?.method === 'POST'
    ? new Response(JSON.stringify({ error: { code: 'DURABLE_STORAGE_UNAVAILABLE', message: 'secret server detail' } }), { status: 503 })
    : new Response(JSON.stringify({ shop: null, setup_needed: true })));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<LocaleProvider><LocaleSwitch /><SellerWorkspace token="token" /></LocaleProvider>));
    const input = container.querySelector<HTMLInputElement>('#shop-display-name')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'My Shop'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    const calls = fetcher.mock.calls.length;
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'বাংলা')!.click());
    expect(container.querySelector('[role=alert]')?.textContent).toContain('দোকানের তথ্য সংরক্ষণ');
    expect(container.textContent).not.toContain('secret server detail');
    expect(input.value).toBe('My Shop');
    expect(fetcher).toHaveBeenCalledTimes(calls);
  } finally { await act(async () => root.unmount()); container.remove(); fetcher.mockRestore(); localStorage.clear(); }
});

it('keeps the active section and loaded shop when language changes', async () => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async url => new Response(JSON.stringify(
    String(url).includes('/seller/shop') ? { shop: { id: 's', display_name: 'My Shop' }, setup_needed: false }
      : String(url).includes('payment-accounts') ? [] : { items: [], next_cursor: null },
  )));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<LocaleProvider><LocaleSwitch /><SellerWorkspace token="token" /></LocaleProvider>));
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Receiving Accounts'))!.click());
    window.history.replaceState({ marker: 'preserved' }, '', '/?section=accounts');
    const calls = fetcher.mock.calls.length;
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'বাংলা')!.click());
    expect(window.location.search).toBe('?section=accounts');
    expect(window.history.state).toEqual({ marker: 'preserved' });
    expect(container.querySelector('[aria-current=page]')?.textContent).toContain('টাকা গ্রহণের অ্যাকাউন্ট');
    expect(container.textContent).toContain('My Shop');
    expect(fetcher).toHaveBeenCalledTimes(calls);
  } finally { window.history.replaceState(null, '', '/'); await act(async () => root.unmount()); container.remove(); fetcher.mockRestore(); localStorage.clear(); }
});

it('preserves the pending setup request and keyboard focus when switching', async () => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
  let resolvePost!: (response: Response) => void;
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => init?.method === 'POST'
    ? new Promise<Response>(resolve => { resolvePost = resolve; })
    : new Response(JSON.stringify({ shop: null, setup_needed: true })));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<LocaleProvider><LocaleSwitch /><SellerWorkspace token="token" /></LocaleProvider>));
    const input = container.querySelector<HTMLInputElement>('#shop-display-name')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'My Shop'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    const languageButton = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'বাংলা')!;
    languageButton.focus();
    await act(async () => languageButton.click());
    expect(document.activeElement).toBe(languageButton);
    expect(input.value).toBe('My Shop');
    expect(container.textContent).toContain('তৈরি হচ্ছে');
    expect(fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    await act(async () => resolvePost(new Response(JSON.stringify({ error: { code: 'DURABLE_STORAGE_UNAVAILABLE', message: 'private' } }), { status: 503 })));
    expect(container.querySelector('[role=alert]')?.textContent).toContain('দোকানের তথ্য সংরক্ষণ');
  } finally { await act(async () => root.unmount()); container.remove(); fetcher.mockRestore(); localStorage.clear(); }
});

it('explains loaded record counts in both languages without changing counts', async () => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<LocaleProvider><LocaleSwitch /><ShopMetricsBar metrics={{ date: '2026-10-31', timezone: 'Asia/Dhaka', orders: 0, confirmed: 0, awaiting: 0, pending: 0, payments: 5 }} /></LocaleProvider>));
    expect(container.textContent).toContain('Today in Bangladesh time');
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'বাংলা')!.click());
    expect(container.textContent).toContain('বাংলাদেশ সময়ে আজ');
    expect(container.textContent).toContain('5');
  } finally { await act(async () => root.unmount()); container.remove(); localStorage.clear(); }
});

it('recovers a conflicting setup key only after checking whether a shop exists', async () => {
  localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => init?.method === 'POST'
    ? new Response(JSON.stringify({ error: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'conflict' } }), { status: 409 })
    : new Response(JSON.stringify({ shop: null, setup_needed: true })));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<LocaleProvider><LocaleSwitch /><SellerWorkspace token="token" /></LocaleProvider>));
    const input = container.querySelector<HTMLInputElement>('#shop-display-name')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'My Shop'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    const firstKey = new Headers(fetcher.mock.calls.find(([, init]) => init?.method === 'POST')![1]?.headers).get('Idempotency-Key');
    await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Check shop setup')!.click());
    expect(input.value).toBe('My Shop');
    await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    const posts = fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(new Headers(posts[1][1]?.headers).get('Idempotency-Key')).not.toBe(firstKey);
  } finally { await act(async () => root.unmount()); container.remove(); fetcher.mockRestore(); localStorage.clear(); }
});
