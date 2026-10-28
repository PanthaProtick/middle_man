import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { SellerWorkspace } from './SellerWorkspace';
import { mockOrder } from './courierPostSubmissionTestData';
import type { ReceiptView } from './types';

const receipt: ReceiptView = {
  id: 'tx-1', shop_id: 'shop-1', payment_account_id: 'acc-1', provider: 'bkash',
  trx_id: 'TRX-1', amount_minor: 15000, sender_number_raw: '01712345678',
  sender_number_canonical: '01712345678', occurred_at: '2026-10-28T10:00:00Z',
  reconciliation_state: 'unmatched', has_conflict: false, version: 1,
  created_at: '2026-10-28T10:00:00Z', updated_at: '2026-10-28T10:00:00Z',
  observations: [], related_claims_count: 0,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  localStorage.clear();
  document.body.innerHTML = '';
  window.history.replaceState({}, '', '/');
});

it.each([
  { section: 'orders', prefix: 'order', more: 'Load More Orders' },
  { section: 'transactions', prefix: 'transaction', more: 'Load More Received Payments' },
])('applies Today to $section using a fixed Bangladesh day and clears it', async ({ section, prefix, more }) => {
  localStorage.setItem('middleman.locale', 'en');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-27T18:00:01Z'));
  const queries: URL[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    queries.push(url);
    const body = url.pathname === '/api/seller/shop'
      ? { shop: { id: 'shop-1', owner_id: 'owner-1', display_name: 'Today Shop', created_at: '', updated_at: '' }, setup_needed: false }
      : url.pathname === '/api/seller/payment-accounts'
        ? [] : { items: url.pathname === '/api/seller/orders' ? [mockOrder] : [receipt], next_cursor: 'page-2' };
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  });
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><SellerWorkspace token="token" /></LocaleProvider>));
  const button = (label: string) => {
    const found = Array.from(host.querySelectorAll('button')).find((item) => item.textContent?.trim() === label);
    if (!found) throw new Error(`Missing button: ${label}`);
    return found;
  };
  if (section === 'transactions') await act(async () => {
    Array.from(host.querySelectorAll('button')).find((item) => item.textContent?.includes('Payments & SMS'))!.click();
  });
  const requests = () => queries.filter((url) => url.pathname === `/api/seller/${section}`);
  const mode = host.querySelector<HTMLSelectElement>(`#${prefix}-date-mode`)!;
  const select = async (value: string) => {
    await act(async () => {
      mode.value = value;
      mode.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };
  await select('relative');
  await act(async () => button('Last 7 days').click());
  const before = requests().length;
  await select('today');
  expect(requests()).toHaveLength(before + 1);
  expect(mode.selectedOptions[0].textContent).toBe('Today');
  expect(requests().at(-1)!.searchParams.get('from_date')).toBe('2026-10-28');
  expect(requests().at(-1)!.searchParams.get('to_date')).toBe('2026-10-28');
  expect(requests().at(-1)!.searchParams.has('cursor')).toBe(false);
  vi.setSystemTime(new Date('2026-10-28T18:00:01Z'));
  await act(async () => button(more).click());
  expect(requests().at(-1)!.searchParams.get('from_date')).toBe('2026-10-28');
  expect(requests().at(-1)!.searchParams.get('to_date')).toBe('2026-10-28');
  expect(requests().at(-1)!.searchParams.get('cursor')).toBe('page-2');
  const beforeLanguage = requests().length;
  await act(async () => host.querySelector<HTMLButtonElement>('button[lang="bn"]')!.click());
  expect(mode.selectedOptions[0].textContent).toBe('আজ');
  expect(requests()).toHaveLength(beforeLanguage);
  await select('any');
  expect(requests().at(-1)!.searchParams.has('from_date')).toBe(false);
  expect(requests().at(-1)!.searchParams.has('to_date')).toBe(false);
  expect(requests().at(-1)!.searchParams.has('cursor')).toBe(false);
  await act(async () => root.unmount());
});
