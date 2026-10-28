import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { lastDaysRange } from './orderDateFilter';
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

const SHOP = {
  id: 'shop-1', owner_id: 'owner-1', display_name: 'Date Shop',
  created_at: '', updated_at: '',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function order(overrides: Partial<SellerOrder>): SellerOrder {
  return { ...mockOrder, ...overrides };
}

function listUrls(urls: string[]): string[] {
  return urls.filter((url) => new URL(url, 'http://localhost').pathname === '/api/seller/orders');
}

function setupFetch(
  list?: (url: URL) => Response | Promise<Response>,
  overrides: { items?: SellerOrder[]; nextCursor?: string | null } = {},
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
      return Promise.resolve(jsonResponse({ items: [], next_cursor: null }));
    }
    if (url.pathname === '/api/seller/orders/export') {
      return Promise.resolve(new Response('header\r\n', { headers: { 'X-Export-Count': '0' } }));
    }
    if (url.pathname === '/api/seller/orders') {
      if (list) return Promise.resolve(list(url));
      return Promise.resolve(jsonResponse({
        items: overrides.items ?? [order({ id: 'initial', product_name: 'Initial Order' })],
        next_cursor: overrides.nextCursor ?? null,
      }));
    }
    return Promise.reject(new Error(`Unhandled URL: ${raw}`));
  });
  return urls;
}

async function mount(element: React.JSX.Element) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, root };
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
  const select = host.querySelector<HTMLSelectElement>('#order-date-mode')!;
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
  const urls = setupFetch();
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  const initialRequests = listUrls(urls).length;

  await selectMode(host, 'custom');
  expect(listUrls(urls)).toHaveLength(initialRequests);
  await setInput(input(host, 'order-date-from'), '2026-10-01');
  await setInput(input(host, 'order-date-to'), '2026-10-28');
  await act(async () => button(host, 'Apply dates').click());

  const applied = listUrls(urls).at(-1)!;
  expect(applied).toContain('from_date=2026-10-01');
  expect(applied).toContain('to_date=2026-10-28');
  expect(window.location.search).toBe('');
  expect(host.textContent).toContain('Showing 2026-10-01 to 2026-10-28 (Bangladesh dates).');
  await act(async () => root.unmount());
});

it('keeps input values and focus without a request when the range is invalid', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupFetch();
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await selectMode(host, 'custom');
  const from = input(host, 'order-date-from');
  await setInput(from, '2026-10-29');
  await setInput(input(host, 'order-date-to'), '2026-10-28');
  const before = listUrls(urls).length;

  from.focus();
  await act(async () => button(host, 'Apply dates').click());

  expect(listUrls(urls)).toHaveLength(before);
  expect(alertText(host)).toBe('The start date must be on or before the end date.');
  expect(from.value).toBe('2026-10-29');
  expect(input(host, 'order-date-to').value).toBe('2026-10-28');
  expect(document.activeElement).toBe(from);
  expect(from.getAttribute('aria-invalid')).toBe('true');
  await act(async () => root.unmount());
});

it('rejects a blank custom range with a localized inline error and no request', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupFetch();
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await selectMode(host, 'custom');
  const before = listUrls(urls).length;

  await act(async () => button(host, 'Apply dates').click());

  expect(listUrls(urls)).toHaveLength(before);
  expect(alertText(host)).toBe('Choose both a start date and an end date.');
  await act(async () => root.unmount());
});

it('rejects an invalid custom day count without a request', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupFetch();
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await selectMode(host, 'relative');
  const before = listUrls(urls).length;
  const days = input(host, 'order-date-days');
  await setInput(days, '3651');

  await act(async () => button(host, 'Apply last days').click());

  expect(listUrls(urls)).toHaveLength(before);
  expect(alertText(host)).toBe('Enter a whole number of days from 1 to 3650.');
  expect(days.value).toBe('3651');
  expect(days.getAttribute('aria-invalid')).toBe('true');
  await act(async () => root.unmount());
});

it('clears the active range when switching modes so only one selection is live', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupFetch();
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await selectMode(host, 'custom');
  await setInput(input(host, 'order-date-from'), '2026-10-01');
  await setInput(input(host, 'order-date-to'), '2026-10-28');
  await act(async () => button(host, 'Apply dates').click());
  expect(listUrls(urls).at(-1)).toContain('from_date=2026-10-01');

  await selectMode(host, 'relative');
  const afterModeChange = listUrls(urls).at(-1)!;
  expect(afterModeChange).not.toContain('from_date');
  expect(afterModeChange).not.toContain('to_date');
  expect(host.textContent).not.toContain('Showing 2026-10-01');

  await act(async () => button(host, 'Last 7 days').click());
  const expected = lastDaysRange(7);
  expect(listUrls(urls).at(-1)).toContain(`from_date=${expected.from}`);
  expect(listUrls(urls).at(-1)).toContain(`to_date=${expected.to}`);

  await selectMode(host, 'any');
  const anyTime = listUrls(urls).at(-1)!;
  expect(anyTime).not.toContain('from_date');
  expect(anyTime).not.toContain('to_date');
  await act(async () => root.unmount());
});

it('reuses the captured relative boundaries for load more and CSV export', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupFetch(undefined, { nextCursor: 'cursor-1' });
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await selectMode(host, 'relative');
  await act(async () => button(host, 'Last 7 days').click());
  const expected = lastDaysRange(7);
  const first = listUrls(urls).at(-1)!;
  expect(first).toContain(`from_date=${expected.from}`);
  expect(first).toContain(`to_date=${expected.to}`);
  expect(button(host, 'Download filtered English CSV')).toBeTruthy();

  await act(async () => button(host, 'Load More Orders').click());
  const paged = listUrls(urls).at(-1)!;
  expect(paged).toContain('cursor=cursor-1');
  expect(paged).toContain(`from_date=${expected.from}`);
  expect(paged).toContain(`to_date=${expected.to}`);

  await act(async () => button(host, 'Download filtered English CSV').click());
  const exported = urls.at(-1)!;
  expect(exported).toContain('/api/seller/orders/export?');
  expect(exported).toContain(`from_date=${expected.from}`);
  expect(exported).toContain(`to_date=${expected.to}`);
  await act(async () => root.unmount());
});

it('drops a stale date response after a newer range is applied', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const fresh = order({ id: 'fresh', product_name: 'Fresh Range Result' });
  const stale = order({ id: 'stale', product_name: 'Stale Range Result' });
  const pending = new Map<string, { promise: Promise<Response>; resolve: (value: Response) => void }>();
  const urls = setupFetch((url) => {
    const from = url.searchParams.get('from_date');
    if (!from) {
      return jsonResponse({ items: [order({ id: 'initial', product_name: 'Initial Order' })], next_cursor: null });
    }
    let resolve: (value: Response) => void = () => undefined;
    const promise = new Promise<Response>((done) => { resolve = done; });
    pending.set(from, { promise, resolve });
    return promise;
  });

  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await selectMode(host, 'custom');
  await setInput(input(host, 'order-date-from'), '2026-10-01');
  await setInput(input(host, 'order-date-to'), '2026-10-28');
  await act(async () => button(host, 'Apply dates').click());
  await setInput(input(host, 'order-date-from'), '2026-10-02');
  await act(async () => button(host, 'Apply dates').click());
  expect([...pending.keys()]).toEqual(['2026-10-01', '2026-10-02']);

  await act(async () => {
    pending.get('2026-10-02')!.resolve(jsonResponse({ items: [fresh], next_cursor: null }));
  });
  expect(host.textContent).toContain('Fresh Range Result');
  await act(async () => {
    pending.get('2026-10-01')!.resolve(jsonResponse({ items: [stale], next_cursor: null }));
  });
  expect(host.textContent).toContain('Fresh Range Result');
  expect(host.textContent).not.toContain('Stale Range Result');
  expect(urls.some((url) => url.includes('cursor='))).toBe(false);
  await act(async () => root.unmount());
});

it('preserves selected dates and the active range across a language switch without refetching', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const urls = setupFetch();
  const { host, root } = await mount(
    <LocaleProvider><LocaleSwitch /><SellerWorkspace token="seller-token" /></LocaleProvider>,
  );
  await selectMode(host, 'custom');
  const from = input(host, 'order-date-from');
  await setInput(from, '2026-10-01');
  await setInput(input(host, 'order-date-to'), '2026-10-28');
  await act(async () => button(host, 'Apply dates').click());
  const before = urls.length;

  const bengali = Array.from(host.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === 'বাংলা',
  )!;
  await act(async () => bengali.click());

  expect(urls).toHaveLength(before);
  expect(input(host, 'order-date-from')).toBe(from);
  expect(from.value).toBe('2026-10-01');
  expect(input(host, 'order-date-to').value).toBe('2026-10-28');
  expect(host.querySelector<HTMLSelectElement>('#order-date-mode')!.value).toBe('custom');
  expect(host.textContent).toContain('তারিখ:');
  expect(host.textContent).toContain('2026-10-01 থেকে 2026-10-28');
  await act(async () => root.unmount());
});

it('uses the distinct no-match message when only a date range is active', async () => {
  localStorage.setItem('middleman.locale', 'en');
  setupFetch((url) => {
    if (url.searchParams.get('from_date')) {
      return jsonResponse({ items: [], next_cursor: null });
    }
    return jsonResponse({
      items: [order({ id: 'initial', product_name: 'Initial Order' })],
      next_cursor: null,
    });
  });
  const { host, root } = await mount(<SellerWorkspace token="seller-token" />);
  await selectMode(host, 'custom');
  await setInput(input(host, 'order-date-from'), '2026-10-01');
  await setInput(input(host, 'order-date-to'), '2026-10-28');
  await act(async () => button(host, 'Apply dates').click());

  expect(host.textContent).toContain('No orders match this date range.');
  expect(host.textContent).not.toContain('No orders match this search and filter.');
  await act(async () => root.unmount());
});
