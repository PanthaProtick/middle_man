import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { vi } from 'vitest';
import type { ReceiptView } from './types';

const SHOP = {
  id: 'shop-1', owner_id: 'owner-1', display_name: 'Search Shop',
  created_at: '', updated_at: '',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function receipt(overrides: Partial<ReceiptView>): ReceiptView {
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

export async function mount(element: React.JSX.Element) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, root };
}

export function typeSearch(input: HTMLInputElement, value: string): void {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function deferred() {
  let resolve: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

export function transactionUrls(urls: string[]): URL[] {
  return urls
    .map((url) => new URL(url, 'http://localhost'))
    .filter((url) => url.pathname === '/api/seller/transactions');
}

export function setupWorkspaceFetch(
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

export async function openPayments(host: HTMLElement): Promise<void> {
  const tab = Array.from(host.querySelectorAll('button')).find((item) =>
    item.textContent?.includes('Payments & SMS'),
  );
  if (!tab) throw new Error('Missing payments section tab');
  await act(async () => tab.click());
}
