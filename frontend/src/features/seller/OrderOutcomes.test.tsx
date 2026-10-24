import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { OrderOutcomes } from './OrderOutcomes';
import type { SellerOrder } from './types';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

const baseOrder: SellerOrder = {
  id: 'ord-12345678',
  shop_id: 'shop-1',
  payment_account_id: 'acc-1',
  product_name: 'Leather Bag',
  total_minor: 1200000,
  required_advance_minor: 200000,
  expected_cod_minor: 1000000,
  actual_cod_minor: null,
  account_provider: 'bkash',
  account_receiving_number: '01711111111',
  account_label: 'Primary',
  lifecycle: 'awaiting_buyer',
  version: 1,
  review_reasons: [],
  buyer_revision: null,
  allocation_basis: null,
  portal_token: 'token-abc',
  portal_url: '/orders/token-abc',
  created_at: '2026-10-24T00:00:00Z',
  updated_at: '2026-10-24T00:00:00Z',
  expires_at: '2026-10-26T00:00:00Z',
  completed_at: null,
};

it('cancels an active order with reason and expected version', async () => {
  const onUpdated = vi.fn();
  const writes: RequestInit[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (String(url).includes('/payment-accounts')) {
      return new Response(JSON.stringify([{ id: 'acc-1', is_active: true, provider: 'bkash', receiving_number: '01711111111', label: 'Primary' }]));
    }
    writes.push(init!);
    return new Response(JSON.stringify({ ...baseOrder, lifecycle: 'cancelled', version: 2 }));
  });

  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => root.render(<OrderOutcomes order={baseOrder} token="mock-token" onUpdated={onUpdated} />));

  // Click Cancel Order button
  const cancelBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Cancel Order'));
  expect(cancelBtn).toBeDefined();
  await act(async () => cancelBtn!.click());

  expect(container.textContent).toContain('Cancel Order #ord-1234');

  // Fill in reason
  const textarea = container.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Customer cancellation request');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // Submit form
  await act(async () => {
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  expect(writes.length).toBe(1);
  const payload = JSON.parse(String(writes[0]?.body));
  expect(payload).toEqual({
    action: 'cancel',
    expected_version: 1,
    reason: 'Customer cancellation request',
  });
  expect(writes[0]?.headers).toHaveProperty('Idempotency-Key');
  expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ lifecycle: 'cancelled', version: 2 }));

  await act(async () => root.unmount());
});

it('rejects a pending unconfirmed order with reason', async () => {
  const onUpdated = vi.fn();
  const pendingOrder: SellerOrder = { ...baseOrder, lifecycle: 'pending', buyer_revision: 1, version: 2 };
  const writes: RequestInit[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (String(url).includes('/payment-accounts')) {
      return new Response(JSON.stringify([]));
    }
    writes.push(init!);
    return new Response(JSON.stringify({ ...pendingOrder, lifecycle: 'rejected', version: 3 }));
  });

  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => root.render(<OrderOutcomes order={pendingOrder} token="mock-token" onUpdated={onUpdated} />));

  const rejectBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Reject Submission'));
  expect(rejectBtn).toBeDefined();
  await act(async () => rejectBtn!.click());

  const textarea = container.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Fraudulent submission');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await act(async () => {
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  expect(writes.length).toBe(1);
  const payload = JSON.parse(String(writes[0]?.body));
  expect(payload).toEqual({
    action: 'reject',
    expected_version: 2,
    reason: 'Fraudulent submission',
  });
  expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ lifecycle: 'rejected', version: 3 }));

  await act(async () => root.unmount());
});

it('replaces unallocated order and prevents replacing allocated order', async () => {
  const onReplaced = vi.fn();
  const writes: RequestInit[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (String(url).includes('/payment-accounts')) {
      return new Response(JSON.stringify([{ id: 'acc-1', is_active: true, provider: 'bkash', receiving_number: '01711111111', label: 'Primary' }]));
    }
    writes.push(init!);
    return new Response(JSON.stringify({ ...baseOrder, id: 'new-ord-999', product_name: 'Premium Leather Bag', predecessor_order_id: baseOrder.id }));
  });

  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);

  await act(async () => root.render(<OrderOutcomes order={baseOrder} token="mock-token" onUpdated={vi.fn()} onReplaced={onReplaced} />));

  const replaceBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Replace Order'));
  expect(replaceBtn).toBeDefined();
  await act(async () => replaceBtn!.click());

  const textarea = container.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'Customer selected premium model');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await act(async () => {
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });

  expect(writes.length).toBe(1);
  const payload = JSON.parse(String(writes[0]?.body));
  expect(payload.reason).toBe('Customer selected premium model');
  expect(payload.expected_version).toBe(1);
  expect(payload.order.product_name).toBe('Leather Bag');
  expect(onReplaced).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-ord-999' }));

  // Test allocated order
  const confirmedOrder: SellerOrder = { ...baseOrder, lifecycle: 'confirmed', allocation_basis: 'automatic' };
  await act(async () => root.render(<OrderOutcomes order={confirmedOrder} token="mock-token" onUpdated={vi.fn()} />));

  expect(container.textContent).toContain('Allocated orders require payment resolution before replacement');
  expect(Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Replace Order'))).toBeUndefined();

  await act(async () => root.unmount());
});
