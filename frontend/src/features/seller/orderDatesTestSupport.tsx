import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, vi } from 'vitest';
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

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function order(overrides: Partial<SellerOrder>): SellerOrder {
  return { ...mockOrder, ...overrides };
}

export function listUrls(urls: string[]): string[] {
  return urls.filter((url) => new URL(url, 'http://localhost').pathname === '/api/seller/orders');
}

export function setupFetch(
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

export async function mount(element: React.JSX.Element) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, root };
}

export function button(host: HTMLElement, label: string): HTMLButtonElement {
  const found = Array.from(host.querySelectorAll('button')).find(
    (item) => item.textContent?.trim() === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}

export function input(host: HTMLElement, id: string): HTMLInputElement {
  const found = host.querySelector<HTMLInputElement>(`#${id}`);
  if (!found) throw new Error(`Missing input: ${id}`);
  return found;
}

export async function selectMode(host: HTMLElement, value: string): Promise<void> {
  const select = host.querySelector<HTMLSelectElement>('#order-date-mode')!;
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

export async function setInput(field: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, value);
    field.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function alertText(host: HTMLElement): string | undefined {
  return host.querySelector('[role="alert"]')?.textContent ?? undefined;
}
