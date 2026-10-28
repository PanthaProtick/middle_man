import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleContext, englishTranslate } from '../locale/context';
import { BuyerCorrection } from './BuyerCorrection';
import { OrderOutcomes } from './OrderOutcomes';
import type { SellerOrder } from './types';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

const order = { id: 'order-opaque-id', version: 1, lifecycle: 'pending', review_reasons: ['SENDER_MISMATCH'],
  product_name: 'Original name', total_minor: 100000, required_advance_minor: 20000,
  payment_account_id: 'account-1', allocation_basis: null, replaced_by_order_id: null } as SellerOrder;

it('switches correction drafts and history without changing user text or sending a request', async () => {
  const revision = {id: 'revision-1', revision_number: 1, buyer_name: 'রহিম Original', contact_number: '01711111111',
    address: {raw_text: 'Dhaka address'}, payment_claim: {provider: 'bkash', trx_id: 'TX-1', sender_number: '01822222222', amount_minor: 20000},
    actor: 'seller:opaque', reason: 'Buyer wrote this', created_at: '2026-10-23T00:00:00Z', claim_accepted_at: '2026-10-23T00:00:00Z'};
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(order)))
    .mockResolvedValueOnce(new Response(JSON.stringify({items: [revision], next_cursor: null})));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const render = (locale: 'en' | 'bn') => root.render(<LocaleContext.Provider value={{locale, setLocale: vi.fn(), t: englishTranslate}}>
    <BuyerCorrection orderId={order.id} token="seller" />
  </LocaleContext.Provider>);
  await act(async () => render('en'));
  const reason = host.querySelector<HTMLTextAreaElement>('label:last-child textarea')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, 'Exact reason'); reason.dispatchEvent(new Event('input', {bubbles: true})); });
  await act(async () => render('bn'));
  expect(host.textContent).toContain('ক্রেতার তথ্যের পরিবর্তনের ইতিহাস');
  expect(host.textContent).toContain('পেমেন্ট পাঠানোর নাম্বার মিলছে না');
  expect(host.textContent).toContain('Buyer wrote this');
  expect(host.textContent).toContain('seller:opaque');
  expect(host.textContent).toContain('অক্টোবর');
  expect(reason.value).toBe('Exact reason');
  expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
});

it('switches a selected outcome and retries the frozen request after an uncertain result', async () => {
  const requests: RequestInit[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (String(url).includes('payment-accounts')) return new Response(JSON.stringify([]));
    requests.push(init!);
    if (requests.length === 1) throw new Error('Offline');
    return new Response(JSON.stringify({...order, lifecycle: 'cancelled', version: 2}));
  });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const updated = vi.fn();
  const render = (locale: 'en' | 'bn') => root.render(<LocaleContext.Provider value={{locale, setLocale: vi.fn(), t: englishTranslate}}>
    <OrderOutcomes order={order} token="seller" onUpdated={updated} />
  </LocaleContext.Provider>);
  await act(async () => render('en'));
  await act(async () => host.querySelector('button')!.click());
  const reason = host.querySelector('textarea')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, 'Exact reason'); reason.dispatchEvent(new Event('input', {bubbles: true})); });
  await act(async () => render('bn'));
  expect(reason.value).toBe('Exact reason');
  expect(host.textContent).toContain('বাতিল নিশ্চিত করুন');
  const submit = async () => act(async () => {host.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));});
  await submit();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('ফল জানা যায়নি');
  await act(async () => render('en'));
  expect(host.textContent).toContain('Outcome unknown');
  await submit();
  expect(requests).toHaveLength(2);
  expect(requests[0]?.body).toBe(requests[1]?.body);
  expect(requests[0]?.headers).toEqual(requests[1]?.headers);
  expect(updated).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
});
