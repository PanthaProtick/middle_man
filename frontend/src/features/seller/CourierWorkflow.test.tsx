import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { OrderDetailModal } from './OrderDetailModal';
import type { SellerOrder } from './types';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

it('refreshes the same order proposal after cancellation in the modal', async () => {
  const order: SellerOrder = {
    id: 'order-a', shop_id: 'shop-a', payment_account_id: 'account-a', product_name: 'Bag',
    total_minor: 1200000, required_advance_minor: 200000, expected_cod_minor: 1000000,
    actual_cod_minor: 1000000, account_provider: 'bkash', account_receiving_number: '01711111111',
    account_label: 'Primary', lifecycle: 'confirmed', version: 3, review_reasons: [],
    buyer_revision: null, allocation_basis: 'automatic', portal_token: 'public', portal_url: '/orders/public',
    created_at: '2026-10-26T10:00:00Z', updated_at: '2026-10-26T10:00:00Z',
    expires_at: '2026-10-28T10:00:00Z', completed_at: '2026-10-26T10:00:00Z',
  };
  let cancelled = false;
  let draftReads = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (String(url).endsWith('/courier-draft')) {
      draftReads++;
      return new Response(JSON.stringify({ order_id: order.id, status: 'local_proposal',
        version: 1, recipient_name: 'Buyer', contact_number: '01711111111', address: 'Dhaka',
        remaining_cod_minor: 1000000, parcel_weight_grams: null, parcel_quantity: null,
        missing_parcel_fields: cancelled ? [] : ['weight', 'quantity'],
        blockers: cancelled ? ['ORDER_NOT_CONFIRMED'] : ['PARCEL_DETAILS_REQUIRED'] }));
    }
    if (String(url).endsWith('/decisions')) {
      cancelled = true;
      return new Response(JSON.stringify({ ...order, lifecycle: 'cancelled', version: 4 }));
    }
    return new Response('[]');
  });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<OrderDetailModal order={order} token="seller" onClose={() => {}} />));
  expect(draftReads).toBe(1);
  const cancel = Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Cancel Order'))!;
  await act(async () => cancel.click());
  const reason = host.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, 'Stop dispatch');
    reason.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => reason.closest('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(draftReads).toBe(2);
  expect(host.textContent).toContain('no longer confirmed');
  await act(async () => root.unmount());
});
