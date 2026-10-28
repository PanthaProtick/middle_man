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
  reason.focus();
  await act(async () => render('bn'));
  expect(host.textContent).toContain('ক্রেতার তথ্যের পরিবর্তনের ইতিহাস');
  expect(host.textContent).toContain('পেমেন্ট পাঠানোর নাম্বার মিলছে না');
  expect(host.textContent).toContain('Buyer wrote this');
  expect(host.textContent).toContain('seller:opaque');
  expect(host.textContent).toContain('অক্টোবর');
  expect(reason.value).toBe('Exact reason');
  expect(document.activeElement).toBe(reason);
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
  reason.focus();
  expect(document.activeElement).toBe(reason);
  expect(host.textContent).toContain('বাতিল নিশ্চিত করুন');
  const submit = async () => act(async () => {host.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));});
  await submit();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('ফল জানা যায়নি');
  await act(async () => render('en'));
  expect(host.textContent).toContain('Outcome unknown');
  expect(host.querySelector('textarea')?.disabled).toBe(true);
  await submit();
  expect(requests).toHaveLength(2);
  expect(requests[0]?.body).toBe(requests[1]?.body);
  expect(requests[0]?.headers).toEqual(requests[1]?.headers);
  expect(updated).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
});

it('offers an actionable retry after correction load fails', async () => {
  const revision = {id: 'revision', revision_number: 1, buyer_name: 'Buyer', contact_number: '01711111111',
    address: {raw_text: 'Address'}, payment_claim: {provider: 'bkash', trx_id: 'TX', sender_number: '01822222222', amount_minor: 20000},
    actor: 'buyer', reason: null, created_at: '2026-10-23T00:00:00Z', claim_accepted_at: '2026-10-23T00:00:00Z'};
  const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(new Response(JSON.stringify(order)))
    .mockResolvedValueOnce(new Response(JSON.stringify({items: [revision], next_cursor: null})));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<BuyerCorrection orderId={order.id} token="seller" />));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Correction unavailable');
  await act(async () => host.querySelector('button')!.click());
  expect(host.querySelector('form')).not.toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(3);
  await act(async () => root.unmount());
});

it('hides replacement on rejected and cancelled orders', async () => {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  for (const lifecycle of ['rejected', 'cancelled'] as const) {
    await act(async () => root.render(<OrderOutcomes order={{...order, lifecycle}} onUpdated={vi.fn()} />));
    expect(host.textContent).not.toContain('Replace Order');
  }
  await act(async () => root.unmount());
});

it('retries an unknown replacement with the frozen money and account payload', async () => {
  const writes: RequestInit[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (String(url).includes('payment-accounts')) return new Response(JSON.stringify([{id: 'account-1', is_active: true, provider: 'bkash', receiving_number: '01711111111', label: 'Primary'}]));
    writes.push(init!);
    if (writes.length === 1) throw new Error('offline');
    return new Response(JSON.stringify({...order, id: 'new-order'}));
  });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const replaced = vi.fn();
  await act(async () => root.render(<OrderOutcomes order={order} token="seller" onUpdated={vi.fn()} onReplaced={replaced} />));
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Replace Order'))!.click());
  const reason = host.querySelector('textarea')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, 'Replace as requested'); reason.dispatchEvent(new Event('input', {bubbles: true})); });
  const submit = async () => act(async () => {host.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));});
  await submit();
  expect(host.textContent).toContain('Outcome unknown');
  expect(host.querySelector<HTMLInputElement>('input')?.disabled).toBe(true);
  await submit();
  expect(writes).toHaveLength(2);
  expect(writes[0]?.body).toBe(writes[1]?.body);
  expect(writes[0]?.headers).toEqual(writes[1]?.headers);
  expect(replaced).toHaveBeenCalledOnce();
  await act(async () => root.unmount());
});

it('keeps a rejection in flight through a language switch without sending it again', async () => {
  let finish!: (response: Response) => void;
  const writes: RequestInit[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (String(url).includes('payment-accounts')) return new Response(JSON.stringify([]));
    writes.push(init!);
    return new Promise<Response>(resolve => { finish = resolve; });
  });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const updated = vi.fn();
  const render = (locale: 'en' | 'bn') => root.render(<LocaleContext.Provider value={{locale, setLocale: vi.fn(), t: englishTranslate}}>
    <OrderOutcomes order={order} token="seller" onUpdated={updated} />
  </LocaleContext.Provider>);
  await act(async () => render('en'));
  await act(async () => Array.from(host.querySelectorAll('button')).find(button => button.textContent?.includes('Reject Submission'))!.click());
  const reason = host.querySelector('textarea')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, 'Buyer text unchanged'); reason.dispatchEvent(new Event('input', {bubbles: true})); });
  act(() => {host.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));});
  act(() => render('bn'));
  expect(host.textContent).toContain('প্রত্যাখ্যান হচ্ছে');
  expect(reason.value).toBe('Buyer text unchanged');
  expect(writes).toHaveLength(1);
  await act(async () => finish(new Response(JSON.stringify({...order, lifecycle: 'rejected', version: 2}))));
  expect(updated).toHaveBeenCalledOnce();
  expect(JSON.parse(String(writes[0]?.body)).reason).toBe('Buyer text unchanged');
  await act(async () => root.unmount());
});

it('localizes a coded correction field error and associates it with the field', async () => {
  const revision = {id: 'revision', revision_number: 1, buyer_name: 'Buyer', contact_number: '01711111111',
    address: {raw_text: 'Address'}, payment_claim: {provider: 'bkash', trx_id: 'TX', sender_number: '01822222222', amount_minor: 20000},
    actor: 'buyer', reason: null, created_at: '2026-10-23T00:00:00Z', claim_accepted_at: '2026-10-23T00:00:00Z'};
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(order)))
    .mockResolvedValueOnce(new Response(JSON.stringify({items: [revision], next_cursor: null})))
    .mockResolvedValueOnce(new Response(JSON.stringify({error: {code: 'VALIDATION_ERROR', message: 'unsafe backend prose',
      fields: [{field: 'buyer_name', code: 'string_too_long', message: 'unsafe field prose'},
        {field: 'payment_claim', code: 'value_error', message: 'unsafe payment prose'}]}}), {status: 422}));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<LocaleContext.Provider value={{locale: 'bn', setLocale: vi.fn(), t: englishTranslate}}>
    <BuyerCorrection orderId={order.id} token="seller" />
  </LocaleContext.Provider>));
  const reason = host.querySelector<HTMLTextAreaElement>('label:last-child textarea')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(reason, 'Exact reason'); reason.dispatchEvent(new Event('input', {bubbles: true})); });
  await act(async () => {host.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));});
  expect(host.textContent).toContain('ক্রেতার নাম: এই তথ্য ঠিক করে আবার চেষ্টা করুন।');
  expect(host.textContent).not.toContain('unsafe backend prose');
  expect(host.querySelector<HTMLInputElement>('input')?.getAttribute('aria-describedby')).toBe('correction-error-buyer_name');
  expect(host.querySelector('fieldset fieldset')?.getAttribute('aria-describedby')).toBe('correction-error-payment_claim');
  await act(async () => root.unmount());
});
