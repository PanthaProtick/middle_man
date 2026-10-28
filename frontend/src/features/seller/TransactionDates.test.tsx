import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';


import { SellerWorkspace } from './SellerWorkspace';

import type { ReceiptView } from './types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

const SHOP = {
  id: 'shop-1', owner_id: 'owner-1', display_name: 'Search Shop',
  created_at: '', updated_at: '',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function receipt(overrides: Partial<ReceiptView>): ReceiptView {
  return {
    id: 'tx-initial',
    shop_id: 'shop-1',
    payment_account_id: 'acc-1',
    provider: 'bkash',
    trx_id: 'TRX-INITIAL',
    amount_minor: 15000,
    sender_number_raw: '01712345678',
    sender_number_canonical: '01712345678',
    occurred_at: '2026-10-24T10:00:00Z',
    reconciliation_state: 'unmatched',
    has_conflict: false,
    version: 1,
    created_at: '2026-10-24T10:00:00Z',
    updated_at: '2026-10-24T10:00:00Z',
    observations: [],
    related_claims_count: 0,
    ...overrides,
  };
}

async function mount(element: React.JSX.Element) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, root };
}

function typeSearch(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function deferred() {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

function transactionUrls(urls: string[]): URL[] {
  return urls
    .map((url) => new URL(url, 'http://localhost'))
    .filter((url) => url.pathname === '/api/seller/transactions');
}

function setupWorkspaceFetch(
  transactions: (url: URL) => Response | Promise<Response>,
): string[] {
  const urls: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const raw = String(input);
    urls.push(raw);
    const url = new URL(raw, 'http://localhost');
    if (url.pathname === '/api/seller/shop') {
      return Promise.resolve(jsonResponse({ shop: SHOP, setup_needed: false }));
    }
    if (url.pathname === '/api/seller/payment-accounts') return Promise.resolve(jsonResponse([]));
    if (url.pathname === '/api/seller/transactions') {
      return Promise.resolve(transactions(url));
    }
    if (url.pathname === '/api/seller/orders') {
      return Promise.resolve(jsonResponse({ items: [], next_cursor: null }));
    }
    return Promise.reject(new Error(`Unhandled URL: ${raw}`));
  });
  return urls;
}

async function openPayments(host: HTMLElement): Promise<void> {
  const tab = Array.from(host.querySelectorAll('button')).find((item) =>
    item.textContent?.includes('Payments & SMS'),
  );
  if (!tab) throw new Error('Missing payments section tab');
  await act(async () => tab.click());
}

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(host.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}

function input(host: HTMLElement, id: string): HTMLInputElement {
  const found = host.querySelector<HTMLInputElement>(`#${id}`);
  if (!found) throw new Error(`Missing input: ${id}`);
  return found;
}

async function selectMode(host: HTMLElement, value: string): Promise<void> {
  const select = host.querySelector<HTMLSelectElement>('#transaction-date-mode')!;
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function setInput(field: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function alertText(host: HTMLElement): string | undefined {
  return host.querySelector('[role="alert"]')?.textContent ?? undefined;
}

it('applies an inclusive custom range to the list query without URL state', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupWorkspaceFetch(() => jsonResponse({ items: [], next_cursor: null }));
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await openPayments(host); const initialRequests = transactionUrls(urls).map(String).length;

  await openPayments(host); await selectMode(host, 'custom');
  expect(transactionUrls(urls).map(String)).toHaveLength(initialRequests);
  await setInput(input(host, 'transaction-date-from'), '2026-10-01');
  await setInput(input(host, 'transaction-date-to'), '2026-10-28');
  await act(async () => button(host, 'Apply dates').click());

  const applied = transactionUrls(urls).map(String).at(-1)!;
  expect(applied).toContain('from_date=2026-10-01');
  expect(applied).toContain('to_date=2026-10-28');
  expect(window.location.search).toBe('');
  expect(host.textContent).toContain('Showing 2026-10-01 to 2026-10-28 (Bangladesh dates).');
  await act(async () => root.unmount());
});

it('keeps input values and focus without a request when the range is invalid', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupWorkspaceFetch(() => jsonResponse({ items: [], next_cursor: null }));
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await openPayments(host); await selectMode(host, 'custom');
  const from = input(host, 'transaction-date-from');
  await setInput(from, '2026-10-29');
  await setInput(input(host, 'transaction-date-to'), '2026-10-28');
  const before = transactionUrls(urls).map(String).length;

  from.focus();
  await act(async () => button(host, 'Apply dates').click());

  expect(transactionUrls(urls).map(String)).toHaveLength(before);
  expect(alertText(host)).toBe('The start date must be on or before the end date.');
  expect(from.value).toBe('2026-10-29');
  expect(input(host, 'transaction-date-to').value).toBe('2026-10-28');
  expect(document.activeElement).toBe(from);
  expect(from.getAttribute('aria-invalid')).toBe('true');
  await act(async () => root.unmount());
});

it('combines search, reconciliation and a fixed relative window across midnight and language changes', async () => {
  localStorage.setItem('middleman.locale', 'en');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T17:59:59Z'));
  const urls = setupWorkspaceFetch((url) => jsonResponse({
    items: [receipt({ id: url.searchParams.has('cursor') ? 'tx-page-2' : 'tx-initial' })], next_cursor: 'page-2',
  }));
  const { host, root } = await mount(<LocaleProvider><LocaleSwitch /><SellerWorkspace token="token" /></LocaleProvider>);
  await openPayments(host);
  await selectMode(host, 'relative');
  await act(async () => button(host, 'Last 7 days').click());
  await act(async () => typeSearch(input(host, 'transaction-search'), 'TRX'));
  const filter = host.querySelector<HTMLSelectElement>('#transaction-filter')!;
  await act(async () => {
    filter.value = 'incomplete';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
  });
  vi.setSystemTime(new Date('2026-10-27T18:00:01Z'));
  await act(async () => button(host, 'Load More Received Payments').click());
  const query = transactionUrls(urls).at(-1)!.searchParams;
  expect(query.get('from_date')).toBe('2026-10-21');
  expect(query.get('to_date')).toBe('2026-10-27');
  expect(query.get('cursor')).toBe('page-2');
  expect(query.get('search')).toBe('TRX');
  expect(query.get('parse')).toBe('incomplete');
  const before = transactionUrls(urls).length;
  const field = input(host, 'transaction-date-days');
  field.focus();
  const language = host.querySelector<HTMLButtonElement>('button[lang="bn"]')!;
  await act(async () => language.click());
  expect(transactionUrls(urls)).toHaveLength(before);
  expect(field.value).toBe('7');
  expect(document.activeElement).toBe(field);
  expect(host.textContent).toContain('রেকর্ড করার তারিখ:');
  await act(async () => root.unmount());
  vi.useRealTimers();
});

it('rejects invalid day counts and ignores a stale date response after clearing rows and cursor', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const pending = deferred();
  const urls = setupWorkspaceFetch((url) => url.searchParams.get('from_date') === '2026-10-01'
    ? pending.promise
    : jsonResponse({ items: [receipt({ trx_id: 'CURRENT' })], next_cursor: 'old-cursor' }));
  const { host, root } = await mount(<SellerWorkspace token="token" />);
  await openPayments(host);
  await selectMode(host, 'relative');
  const field = input(host, 'transaction-date-days');
  for (const value of ['', '0', '3651', '1.5']) {
    await setInput(field, value);
    const before = transactionUrls(urls).length;
    field.focus();
    await act(async () => button(host, 'Apply last days').click());
    expect(transactionUrls(urls)).toHaveLength(before);
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field);
  }
  await selectMode(host, 'custom');
  await setInput(input(host, 'transaction-date-from'), '2026-10-01');
  await setInput(input(host, 'transaction-date-to'), '2027-01-01');
  await act(async () => button(host, 'Apply dates').click());
  expect(host.textContent).not.toContain('CURRENT');
  expect(host.textContent).not.toContain('Load More Received Payments');
  await setInput(input(host, 'transaction-date-from'), '2026-10-02');
  await act(async () => button(host, 'Apply dates').click());
  expect(transactionUrls(urls).at(-1)!.searchParams.has('cursor')).toBe(false);
  await act(async () => pending.resolve(jsonResponse({
    items: [receipt({ trx_id: 'STALE' })], next_cursor: 'stale-cursor',
  })));
  expect(host.textContent).toContain('CURRENT');
  expect(host.textContent).not.toContain('STALE');
  await selectMode(host, 'any');
  expect(transactionUrls(urls).at(-1)!.searchParams.has('from_date')).toBe(false);
  await act(async () => root.unmount());
});


