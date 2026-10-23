import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { BuyerCorrection } from './BuyerCorrection';

afterEach(() => vi.restoreAllMocks());

it('requires seller authority when opening a buyer link', async () => {
  const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    error: {code: 'UNAUTHORIZED', message: 'Seller sign-in required'},
  }), {status: 401}));
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<BuyerCorrection portalToken="buyer-link" token="seller-session" />));
  expect(container.textContent).toContain('Seller sign-in required');
  expect(container.querySelector('form')).toBeNull();
  expect(spy.mock.calls[0]?.[1]?.headers).toMatchObject({Authorization: 'Bearer seller-session'});
  await act(async () => root.unmount());
  container.remove();
});

it('retains edits and retries an unknown correction with identical payload and key', async () => {
  const order = {id: 'order', version: 2, lifecycle: 'pending', review_reasons: ['SENDER_MISMATCH']};
  const revision = {id: 'revision', revision_number: 1, buyer_name: 'Buyer', contact_number: '01711111111',
    address: {raw_text: 'Dhaka'}, payment_claim: {provider: 'bkash', trx_id: 'PAY', sender_number: '01822222222', amount_minor: 200000},
    actor: 'buyer', reason: null, created_at: '2026-10-23T00:00:00Z', claim_accepted_at: '2026-10-23T00:00:00Z'};
  const requests: RequestInit[] = [];
  const response = (data: unknown) => new Response(JSON.stringify(data));
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(response(order))
    .mockResolvedValueOnce(response({items: [revision], next_cursor: null}))
    .mockImplementationOnce(async (_url, init) => {requests.push(init!); throw new Error('Connection lost');})
    .mockImplementationOnce(async (_url, init) => {requests.push(init!); return response({...order, version: 3, lifecycle: 'confirmed', review_reasons: []});})
    .mockResolvedValueOnce(response({...order, version: 3, lifecycle: 'confirmed', review_reasons: []}))
    .mockResolvedValueOnce(response({items: [revision, {...revision, id: 'next', revision_number: 2, reason: 'Fix name'}], next_cursor: null}));
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<BuyerCorrection orderId="order" token="seller" />));
  const reason = container.querySelector<HTMLTextAreaElement>('label:last-child textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, 'Fix name');
    reason.dispatchEvent(new Event('input', {bubbles: true}));
  });
  const submit = async () => act(async () => {container.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));});
  await submit();
  expect(container.textContent).toContain('Connection lost');
  expect(reason.value).toBe('Fix name');
  expect(container.textContent).toContain('Retry same correction');
  await submit();
  expect(requests[0]?.body).toBe(requests[1]?.body);
  expect(requests[0]?.headers).toEqual(requests[1]?.headers);
  expect(container.textContent).toContain('confirmed');
  expect(container.textContent).toContain('Buyer revision history (2)');
  await act(async () => root.unmount()); container.remove();
});
