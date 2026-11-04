import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AssistantWorkspace } from './AssistantWorkspace';
import type { PaymentAccount, ReceiptView } from './types';

let root: Root;
let host: HTMLDivElement;
const makeAccount = (overrides: Partial<PaymentAccount>): PaymentAccount => ({
  id: 'account-1', shop_id: 'shop-1', provider: 'bkash', receiving_number: '01711223344',
  label: 'Main', is_active: true, version: 1, created_at: '', updated_at: '', ...overrides,
});
const accounts = [
  makeAccount({}),
  makeAccount({ id: 'account-2', label: 'Other', receiving_number: '01799887766' }),
  makeAccount({ id: 'account-3', provider: 'nagad', label: 'Nagad', receiving_number: '01811223344' }),
];
const receipt = (overrides: Partial<ReceiptView> = {}): ReceiptView => ({
  id: 'receipt-1', shop_id: 'shop-1', payment_account_id: 'account-1', provider: 'bkash',
  trx_id: 'EXACT-Trx 01', amount_minor: 125050, reconciliation_state: 'unmatched',
  has_conflict: false, version: 1, created_at: '', updated_at: '', related_claims_count: 0,
  observations: [{
    id: 'observation-1', transaction_id: 'receipt-1', payment_account_id: 'account-1', source: 'manual',
    provider: 'bkash', trx_id: 'EXACT-Trx 01', actor: 'seller', amount_minor: 125050,
    parse_state: 'incomplete', conflict_state: 'none', created_at: '',
  }], ...overrides,
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  vi.restoreAllMocks(); document.body.innerHTML = ''; localStorage.clear();
});
async function click(label: string) {
  const button = Array.from(host.querySelectorAll('button')).find(item =>
    item.textContent === label || (label === 'Seller assistant' && item.dataset.testid === 'seller-assistant-launcher')
  );
  expect(button, label).toBeDefined();
  await act(async () => button!.click());
}
async function change(name: string, value: string) {
  const input = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}
async function send(message: string) {
  await change('assistant-message', message);
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
async function mount(options: { onOpenPayment?: (receiptId: string) => void } = {}) {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<AssistantWorkspace floating accounts={accounts} token="seller" {...options}>
    <p>Orders</p></AssistantWorkspace>));
  await click('Seller assistant');
  const language = host.querySelector<HTMLSelectElement>('[name="assistant-language"]')!;
  await act(async () => { language.value = 'en'; language.dispatchEvent(new Event('change', { bubbles: true })); });
}
const errorLabels = () => Array.from(host.querySelectorAll('.assistant-payment-fields li')).map(item => item.textContent);

it('reviews editable natural-language details before confirmation and retains the saved account in the timeline', async () => {
  const requests: RequestInit[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
    if (options?.method === 'POST') {
      requests.push(options);
      return new Response(JSON.stringify({ receipt: receipt({ trx_id: '9K23M4', amount_minor: 60000 }), allocated_order_ids: [] }));
    }
    return new Response(JSON.stringify({ storage_epoch: 'epoch' }));
  });
  await mount();
  await send('Bkash received 500 tk TrxID 9K23M4 from 01711000000');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-payment-trx"]')?.value).toBe('9K23M4');
  await change('assistant-payment-account', 'account-1');
  await change('assistant-payment-amount', '600');
  await click('Review');
  expect(requests).toHaveLength(0);
  expect(host.querySelector('[name="assistant-payment-amount"]')).toBeNull();
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Ready to record');
  const actions = host.querySelector('.assistant-payment-fields .assistant-actions');
  expect(Array.from(actions?.querySelectorAll('button') ?? []).map(button => button.textContent))
    .toEqual(['Confirm', 'Make Changes']);
  expect(host.textContent).toContain('01711000000');
  await click('Make Changes');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-payment-amount"]')?.value).toBe('600');
  await click('Review'); await click('Confirm');
  expect(requests).toHaveLength(1);
  expect(JSON.parse(String(requests[0].body))).toMatchObject({ trx_id: '9K23M4', amount_minor: 60000, payment_account_id: 'account-1' });
  const result = host.querySelector('[role="log"] .assistant-result');
  expect(result?.textContent).toContain('Main · BKASH · 01711223344');
  expect(result?.textContent).toContain('9K23M4');
  expect(result?.textContent).toContain('BDT 600.00');
  await click('Record a payment');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-payment-trx"]')?.value).toBe('');
  expect(host.querySelector('[role="log"] .assistant-result')).toBe(result);
  await change('assistant-payment-amount', '0');
  const review = Array.from(host.querySelectorAll('button')).find(item => item.textContent === 'Review');
  expect(review?.disabled).toBe(true);
});

it('collects bilingual payment details locally and only records after explicit confirmation', async () => {
  const requests: { url: string; options?: RequestInit }[] = [];
  const onOpenPayment = vi.fn();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith('/transaction-submissions')) return new Response(JSON.stringify({ storage_epoch: 'epoch' }));
    return new Response(JSON.stringify({ receipt: receipt(), allocated_order_ids: [] }));
  });
  await mount({ onOpenPayment });
  await send('Record payment; account: bkash; trx id: EXACT-Trx 01; amount: ৳১,২৫০.৫০');
  expect(errorLabels()).toEqual(['Receiving account']);
  expect(host.textContent).toContain('matched more than one account');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-payment-trx"]')?.value).toBe('EXACT-Trx 01');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-payment-amount"]')?.value).toBe('৳১,২৫০.৫০');
  await send('account: Main; sender number: 01811223344');
  expect(errorLabels()).toEqual([]);
  expect(host.textContent).toContain('BDT 1,250.50');
  expect(host.textContent).toContain('may automatically confirm');
  expect(requests).toHaveLength(0);
  await click('Review'); await click('Confirm');
  const write = requests.find(request => request.options?.method === 'POST')!;
  expect(write.url).toContain('/api/seller/transaction-submissions/epoch.');
  expect(JSON.parse(String(write.options?.body))).toEqual({
    payment_account_id: 'account-1', provider: 'bkash', trx_id: 'EXACT-Trx 01', amount_minor: 125050,
    sender_number: '01811223344', occurred_at: null,
  });
  expect(host.textContent).toContain('Payment recorded');
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Payment recorded');
  expect(host.textContent).toContain('No matching buyer claim');
  expect(host.textContent).toContain('does not mean the payment provider verified');
  await click('Open payment');
  expect(onOpenPayment).toHaveBeenCalledWith('receipt-1');
});

it('interprets Bangla entry and keeps optional sender and time omitted', async () => {
  const requests: { options?: RequestInit }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
    requests.push({ options });
    if (String(_url).endsWith('/transaction-submissions')) return new Response(JSON.stringify({ storage_epoch: 'epoch' }));
    return new Response(JSON.stringify({ receipt: receipt({ trx_id: 'ABC123', amount_minor: 50000 }), allocated_order_ids: [] }));
  });
  await mount();
  await send('পেমেন্ট রেকর্ড; অ্যাকাউন্ট: Nagad; ট্রানজেকশন আইডি: ABC123; টাকা: ৫০০');
  expect(errorLabels()).toEqual([]);
  await click('Review'); await click('Confirm');
  const write = requests.find(request => request.options?.method === 'POST')!;
  expect(JSON.parse(String(write.options?.body))).toMatchObject({
    payment_account_id: 'account-3', provider: 'nagad', trx_id: 'ABC123', amount_minor: 50000,
    sender_number: null, occurred_at: null,
  });
});

it.each([
  ['en', 'Review', 'Confirm', 'Make Changes', 'Bkash received 500 tk TrxID FIRST from 01711000000'],
  ['bn', 'পর্যালোচনা করুন', 'নিশ্চিত করুন', 'পরিবর্তন করুন', 'বিকাশে ৫০০ টাকা পেয়েছি আইডি FIRST প্রেরক 01711000000'],
])('requires fresh review after conversational corrections and retains two results in %s', async (locale, review, confirm, changes, message) => {
  let writes = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
    if (options?.method !== 'POST') return new Response(JSON.stringify({ storage_epoch: 'epoch' }));
    writes++;
    const payload = JSON.parse(String(options.body));
    return new Response(JSON.stringify({ receipt: receipt({ ...payload, id: `receipt-${writes}` }), allocated_order_ids: [] }));
  });
  await mount();
  const language = host.querySelector<HTMLSelectElement>('[name="assistant-language"]')!;
  await act(async () => { language.value = locale; language.dispatchEvent(new Event('change', { bubbles: true })); });
  await send(message); await change('assistant-payment-account', 'account-1');
  await click(review); await send('amount: 650');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-payment-amount"]')?.value).toBe('650');
  expect(Array.from(host.querySelectorAll('button')).some(item => item.textContent === confirm)).toBe(false);
  expect(writes).toBe(0);
  await click(review); await click(confirm);
  const first = host.querySelector('[role="log"] .assistant-result');
  expect(first?.textContent).toContain('BDT 650.00');
  await send('Record payment; account: Main; trx id: SECOND; amount: 800');
  await click(review); await click(changes);
  expect(host.querySelector<HTMLInputElement>('[name="assistant-payment-trx"]')?.value).toBe('SECOND');
  await click(review); await click(confirm);
  const results = host.querySelectorAll('[role="log"] .assistant-result');
  expect(results).toHaveLength(2);
  expect(results[0]).toBe(first);
  expect(results[0].textContent).toContain('FIRST');
  expect(results[1].textContent).toContain('SECOND');
  expect(writes).toBe(2);
});
