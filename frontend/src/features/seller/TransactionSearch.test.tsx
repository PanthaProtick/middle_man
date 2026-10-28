import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { fetchTransactions } from './api';
import { SellerWorkspace } from './SellerWorkspace';
import { TransactionInbox } from './TransactionInbox';
import type { ReceiptView } from './types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

it('sends one trimmed search term with the reconciliation filter and cursor', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
    Promise.resolve(jsonResponse({ items: [], next_cursor: null })),
  );
  await fetchTransactions(
    { review: 'conflicted', search: '  TRX-99 ', cursor: 'cursor-1' },
    'token',
  );
  const url = String(fetcher.mock.calls[0][0]);
  expect(url).toContain('/api/seller/transactions?');
  expect(url).toContain('cursor=cursor-1');
  expect(url).toContain('review=conflicted');
  expect(url).toContain('search=TRX-99');
  expect(window.location.search).toBe('');

  await fetchTransactions({ search: '   ', parse: 'incomplete' }, 'token');
  expect(String(fetcher.mock.calls[1][0])).toBe('/api/seller/transactions?parse=incomplete');
});

it('renders accessible search guidance and preserves the term across a language switch', async () => {
  localStorage.setItem('middleman.locale', 'en');
  function Harness(): React.JSX.Element {
    const [search, setSearch] = useState('');
    return (
      <TransactionInbox
        transactions={[]}
        filter=""
        onFilterChange={() => undefined}
        search={search}
        onSearchChange={setSearch}
      />
    );
  }
  const fetcher = vi.spyOn(globalThis, 'fetch');
  const { host, root } = await mount(
    <LocaleProvider><LocaleSwitch /><Harness /></LocaleProvider>,
  );
  const input = host.querySelector<HTMLInputElement>('#transaction-search')!;
  expect(input).toBeTruthy();
  expect(host.querySelector('label[for="transaction-search"]')?.textContent).toBe(
    'Search received payments',
  );
  expect(host.querySelector('[role="search"]')).toBeTruthy();

  input.focus();
  await act(async () => typeSearch(input, 'TRX ১২৩'));
  expect(input.value).toBe('TRX ১২৩');
  expect(host.textContent).toContain('No received payments match this search and filter.');
  expect(document.activeElement).toBe(input);

  const clear = host.querySelector<HTMLButtonElement>('button[aria-label="Clear search"]')!;
  expect(clear).toBeTruthy();
  await act(async () => clear.click());
  expect(input.value).toBe('');
  expect(host.textContent).toContain('No received payments recorded yet.');

  await act(async () => typeSearch(input, 'TRX ১২৩'));
  const bengali = Array.from(host.querySelectorAll('button')).find(
    (item) => item.textContent === 'বাংলা',
  )!;
  await act(async () => bengali.click());

  expect(host.querySelector('#transaction-search')).toBe(input);
  expect(input.value).toBe('TRX ১২৩');
  expect(host.textContent).toContain('প্রাপ্ত পেমেন্ট খুঁজুন');
  expect(host.textContent).toContain('এই অনুসন্ধান ও ফিল্টারে কোনো প্রাপ্ত পেমেন্ট মেলেনি।');
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});

it('clears rows, drops stale inbox responses and keeps search and filter while paging', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const initial = receipt({ id: 'tx-initial', trx_id: 'TRX-INITIAL' });
  const fresh = receipt({ id: 'tx-fresh', trx_id: 'TRX-FRESH' });
  const stale = receipt({ id: 'tx-stale', trx_id: 'TRX-STALE' });
  const pending = new Map<string, ReturnType<typeof deferred>>();

  const urls = setupWorkspaceFetch((url) => {
    const search = url.searchParams.get('search');
    if (!search) {
      if (url.searchParams.get('review')) {
        return jsonResponse({ items: [], next_cursor: null });
      }
      return jsonResponse({ items: [initial], next_cursor: null });
    }
    if (url.searchParams.get('cursor')) {
      return jsonResponse({ items: [receipt({ id: 'tx-page-2', trx_id: 'TRX-PAGE-2' })], next_cursor: null });
    }
    const request = deferred();
    pending.set(search, request);
    return request.promise;
  });

  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await openPayments(host);
  expect(host.textContent).toContain('TRX-INITIAL');

  const filter = host.querySelector<HTMLSelectElement>('#transaction-filter')!;
  expect(filter).toBeTruthy();
  await act(async () => {
    filter.value = 'conflicted';
    filter.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(host.textContent).not.toContain('TRX-INITIAL');
  expect(host.textContent).toContain('No received transactions match the selected filter.');
  expect(transactionUrls(urls).at(-1)!.searchParams.get('review')).toBe('conflicted');

  const input = host.querySelector<HTMLInputElement>('#transaction-search')!;
  await act(async () => typeSearch(input, 'alpha'));
  expect(host.textContent).not.toContain('TRX-INITIAL');
  expect(host.textContent).toContain('Loading received payments…');
  await act(async () => typeSearch(input, 'alpine'));
  expect([...pending.keys()]).toEqual(['alpha', 'alpine']);

  await act(async () => {
    pending.get('alpine')!.resolve(jsonResponse({ items: [fresh], next_cursor: 'cursor-alpine' }));
  });
  expect(host.textContent).toContain('TRX-FRESH');
  await act(async () => {
    pending.get('alpha')!.resolve(jsonResponse({ items: [stale], next_cursor: null }));
  });
  expect(host.textContent).toContain('TRX-FRESH');
  expect(host.textContent).not.toContain('TRX-STALE');
  expect(window.location.search).toBe('');

  const typed = transactionUrls(urls).filter((url) => url.searchParams.get('search'));
  expect(typed[0].searchParams.get('search')).toBe('alpha');
  expect(typed[1].searchParams.get('search')).toBe('alpine');
  expect(typed[0].searchParams.get('review')).toBe('conflicted');
  expect(typed.every((url) => !url.searchParams.get('cursor'))).toBe(true);

  const loadMore = Array.from(host.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === 'Load More Received Payments',
  )!;
  await act(async () => loadMore.click());
  const paged = transactionUrls(urls).at(-1)!;
  expect(paged.searchParams.get('cursor')).toBe('cursor-alpine');
  expect(paged.searchParams.get('search')).toBe('alpine');
  expect(paged.searchParams.get('review')).toBe('conflicted');

  await act(async () => {
    host.querySelector<HTMLSelectElement>('#transaction-filter')!.value = 'incomplete';
    host.querySelector<HTMLSelectElement>('#transaction-filter')!
      .dispatchEvent(new Event('change', { bubbles: true }));
  });
  const incomplete = transactionUrls(urls).at(-1)!;
  expect(incomplete.searchParams.get('parse')).toBe('incomplete');
  expect(incomplete.searchParams.get('review')).toBeNull();
  expect(incomplete.searchParams.get('search')).toBe('alpine');
  expect(incomplete.searchParams.get('cursor')).toBeNull();
  await act(async () => root.unmount());
});

it('keeps the typed term and focus when the inbox request fails', async () => {
  localStorage.setItem('middleman.locale', 'en');
  setupWorkspaceFetch((url) => {
    if (url.searchParams.get('search')) return Promise.reject(new Error('offline'));
    return jsonResponse({ items: [], next_cursor: null });
  });

  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await openPayments(host);
  const input = host.querySelector<HTMLInputElement>('#transaction-search')!;
  input.focus();
  await act(async () => typeSearch(input, 'TRX-OFFLINE'));

  expect(host.querySelector('[role="alert"]')?.textContent).toContain(
    'Unable to complete this request. Please retry.',
  );
  expect(host.querySelector<HTMLInputElement>('#transaction-search')).toBe(input);
  expect(input.value).toBe('TRX-OFFLINE');
  expect(document.activeElement).toBe(input);
  await act(async () => root.unmount());
});
it('starts a refreshed inbox without the previous search', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupWorkspaceFetch(() => jsonResponse({ items: [], next_cursor: null }));
  const first = await mount(<SellerWorkspace token="seller-token" />);
  await openPayments(first.host);
  const input = first.host.querySelector<HTMLInputElement>('#transaction-search')!;
  await act(async () => typeSearch(input, 'TRX-KEPT'));
  expect(transactionUrls(urls).at(-1)!.searchParams.get('search')).toBe('TRX-KEPT');

  await act(async () => first.root.unmount());
  const second = await mount(<SellerWorkspace token="seller-token" />);
  await openPayments(second.host);

  const refreshed = transactionUrls(urls).at(-1)!;
  expect(refreshed.searchParams.get('search')).toBeNull();
  expect(second.host.querySelector<HTMLInputElement>('#transaction-search')!.value).toBe('');
  expect(window.location.search).toBe('');
  await act(async () => second.root.unmount());
});
