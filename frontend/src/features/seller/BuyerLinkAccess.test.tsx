import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { BuyerLinkAccess } from './BuyerLinkAccess';
import type { SellerOrder } from './types';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

const order: SellerOrder = {
  id: 'order-1', shop_id: 'shop', payment_account_id: 'account', product_name: 'Bag',
  total_minor: 10000, required_advance_minor: 2000, expected_cod_minor: 8000,
  actual_cod_minor: null, account_provider: 'bkash', account_receiving_number: '01711111111',
  account_label: 'Primary', lifecycle: 'pending', version: 2, portal_token: 'opaque',
  portal_url: '/orders/opaque', created_at: '', updated_at: '', expires_at: '', completed_at: null,
  review_reasons: [], buyer_revision: 1, allocation_basis: null,
};

it('retries an uncertain revocation with the identical payload and key', async () => {
  const writes: RequestInit[] = [];
  const onUpdated = vi.fn();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    writes.push(init!);
    if (writes.length === 1) throw new TypeError('Connection lost');
    return new Response(JSON.stringify({ ...order, version: 3, buyer_link_revoked_at: '2026-10-25T00:00:00Z' }));
  });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<BuyerLinkAccess order={order} token="session" onUpdated={onUpdated} />));
  await act(async () => host.querySelector('button')!.click());
  expect(host.textContent).toContain('Retry');
  expect(onUpdated).not.toHaveBeenCalled();
  await act(async () => host.querySelector('button')!.click());
  expect(writes[1].body).toBe(writes[0].body);
  expect(writes[1].headers).toEqual(writes[0].headers);
  expect(JSON.parse(String(writes[0].body))).toEqual({ expected_version: 2 });
  expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ version: 3, lifecycle: 'pending' }));
  await act(async () => root.unmount());
});

it('shows revoked access without offering another mutation', async () => {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<BuyerLinkAccess order={{ ...order, buyer_link_revoked_at: '2026-10-25T00:00:00Z' }} token="session" onUpdated={vi.fn()} />));
  expect(host.textContent).toContain('Buyer link revoked');
  expect(host.querySelector('button')).toBeNull();
  await act(async () => root.unmount());
});

it('blocks a stale action and tells the seller to refresh before starting again', async () => {
  const onUpdated = vi.fn();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    error: { code: 'STALE_VERSION', message: 'Order changed' },
  }), { status: 409 }));
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<BuyerLinkAccess order={order} token="session" onUpdated={onUpdated} />));
  await act(async () => host.querySelector('button')!.click());
  expect(host.textContent).toContain('Close and reopen');
  expect(host.querySelector('button')!.disabled).toBe(true);
  expect(onUpdated).not.toHaveBeenCalled();
  await act(async () => root.unmount());
});
