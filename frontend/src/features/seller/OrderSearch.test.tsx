import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { fetchOrders } from './api';
import { OrderExport } from './OrderExport';
import { OrderList } from './OrderList';
import { SellerWorkspace } from './SellerWorkspace';
import { mockOrder } from './courierPostSubmissionTestData';
import type { SellerOrder } from './types';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

async function mount(element: React.JSX.Element) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, root };
}

function order(overrides: Partial<SellerOrder>): SellerOrder {
  return { ...mockOrder, ...overrides };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function deferredResponse() {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

function typeSearch(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(host.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}

it('builds the orders query with a trimmed search and no URL state', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(
    () => Promise.resolve(jsonResponse({ items: [], next_cursor: null })),
  );
  await fetchOrders({ status: 'pending', search: '  Rahim Uddin ', cursor: 'cursor-1' }, 'token');
  const first = String(fetcher.mock.calls[0][0]);
  expect(first).toContain('/api/seller/orders?');
  expect(first).toContain('cursor=cursor-1');
  expect(first).toContain('status=pending');
  expect(first).toContain('search=Rahim+Uddin');
  expect(window.location.search).toBe('');

  await fetchOrders({ search: '   ' }, 'token');
  expect(String(fetcher.mock.calls[1][0])).toBe('/api/seller/orders');
});

it('renders an accessible search control, distinct no-match guidance and localized value', async () => {
  localStorage.setItem('middleman.locale', 'en');
  function Harness(): React.JSX.Element {
    const [search, setSearch] = useState('');
    return (
      <OrderList
        orders={[]}
        statusFilter=""
        onFilterChange={() => undefined}
        nextCursor={null}
        onLoadMore={() => undefined}
        search={search}
        onSearchChange={setSearch}
      />
    );
  }
  const fetcher = vi.spyOn(globalThis, 'fetch');
  const { host, root } = await mount(
    <LocaleProvider><LocaleSwitch /><Harness /></LocaleProvider>,
  );
  const input = host.querySelector<HTMLInputElement>('#order-search')!;
  expect(input).toBeTruthy();
  expect(host.querySelector('label[for="order-search"]')?.textContent).toBe('Search orders');
  expect(host.querySelector('[role="search"]')).toBeTruthy();

  input.focus();
  await act(async () => typeSearch(input, 'Bag ১২'));
  expect(input.value).toBe('Bag ১২');
  expect(host.textContent).toContain('No orders match this search and filter.');
  expect(document.activeElement).toBe(input);

  const clear = host.querySelector<HTMLButtonElement>('button[aria-label="Clear search"]')!;
  expect(clear).toBeTruthy();
  await act(async () => clear.click());
  expect(input.value).toBe('');
  expect(host.textContent).not.toContain('No orders match this search and filter.');

  await act(async () => typeSearch(input, 'Bag ১২'));
  expect(input.value).toBe('Bag ১২');
  const bengali = Array.from(host.querySelectorAll('button')).find(
    (item) => item.textContent === 'বাংলা',
  )!;
  await act(async () => bengali.click());
  expect(host.querySelector('#order-search')).toBe(input);
  expect(input.value).toBe('Bag ১২');
  expect(host.textContent).toContain('অর্ডার খুঁজুন');
  expect(host.textContent).toContain('এই অনুসন্ধান ও ফিল্টারে কোনো অর্ডার মেলেনি।');
  expect(fetcher).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});

it('drops a stale order response after the search changes and keeps paging on the current search', async () => {
  const initial = order({ id: 'order-initial', product_name: 'Initial Order' });
  const fresh = order({ id: 'order-fresh', product_name: 'Fresh Result' });
  const stale = order({ id: 'order-stale', product_name: 'Stale Result' });
  const pending = new Map<string, ReturnType<typeof deferredResponse>>();
  const listUrls: string[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/seller/shop')) {
      return Promise.resolve(jsonResponse({
        shop: { id: 's1', owner_id: 'o1', display_name: 'Search Shop', created_at: '', updated_at: '' },
        setup_needed: false,
      }));
    }
    if (url.includes('/seller/payment-accounts')) return Promise.resolve(jsonResponse([]));
    if (url.includes('/seller/transactions')) {
      return Promise.resolve(jsonResponse({ items: [], next_cursor: null }));
    }
    if (url.includes('/seller/orders')) {
      listUrls.push(url);
      const parsed = new URL(url, 'http://localhost');
      const search = parsed.searchParams.get('search');
      if (!search) {
        return Promise.resolve(jsonResponse({ items: [initial], next_cursor: 'cursor-initial' }));
      }
      if (parsed.searchParams.get('cursor')) {
        return Promise.resolve(jsonResponse({ items: [fresh], next_cursor: null }));
      }
      const request = deferredResponse();
      pending.set(search, request);
      return request.promise;
    }
    return Promise.reject(new Error(`Unhandled URL: ${url}`));
  });

  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  expect(host.textContent).toContain('Initial Order');

  const input = host.querySelector<HTMLInputElement>('#order-search')!;
  await act(async () => typeSearch(input, 'alpha'));
  expect(host.textContent).not.toContain('Initial Order');
  expect(host.textContent).toContain('Loading orders…');
  await act(async () => typeSearch(input, 'alpine'));
  expect([...pending.keys()]).toEqual(['alpha', 'alpine']);

  await act(async () => {
    pending.get('alpine')!.resolve(jsonResponse({ items: [fresh], next_cursor: 'cursor-alpine' }));
  });
  expect(host.textContent).toContain('Fresh Result');
  await act(async () => {
    pending.get('alpha')!.resolve(jsonResponse({ items: [stale], next_cursor: null }));
  });
  expect(host.textContent).toContain('Fresh Result');
  expect(host.textContent).not.toContain('Stale Result');
  expect(window.location.search).toBe('');

  const searchUrls = listUrls.filter((url) => url.includes('search='));
  expect(searchUrls[0]).toContain('search=alpha');
  expect(searchUrls[1]).toContain('search=alpine');
  expect(searchUrls.every((url) => !url.includes('cursor='))).toBe(true);

  await act(async () => button(host, 'Load More Orders').click());
  const paged = listUrls.filter((url) => url.includes('cursor=cursor-alpine')).at(-1);
  expect(paged).toContain('search=alpine');
  expect(host.textContent).toContain('Fresh Result');
  await act(async () => root.unmount());
});

it('sends the active search and lifecycle criteria to the CSV export', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('header\r\n', { headers: { 'X-Export-Count': '0' } }),
  );
  const { host, root } = await mount(
    <OrderExport status="pending" search="  Rahim Uddin " token="seller-token" />,
  );
  await act(async () => button(host, 'Download filtered English CSV').click());
  expect(String(fetcher.mock.calls[0][0])).toBe(
    '/api/seller/orders/export?status=pending&search=Rahim+Uddin',
  );
  expect(host.textContent).toContain('No orders match this filter.');
  await act(async () => root.unmount());
});
