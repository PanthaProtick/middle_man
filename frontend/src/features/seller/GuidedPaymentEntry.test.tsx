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
  const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent === label);
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
  await click('Record payment');
  const write = requests.find(request => request.options?.method === 'POST')!;
  expect(write.url).toContain('/api/seller/transaction-submissions/epoch.');
  expect(JSON.parse(String(write.options?.body))).toEqual({
    payment_account_id: 'account-1', provider: 'bkash', trx_id: 'EXACT-Trx 01', amount_minor: 125050,
    sender_number: '01811223344', occurred_at: null,
  });
  expect(host.textContent).toContain('Payment recorded');
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
  await click('Record payment');
  const write = requests.find(request => request.options?.method === 'POST')!;
  expect(JSON.parse(String(write.options?.body))).toMatchObject({
    payment_account_id: 'account-3', provider: 'nagad', trx_id: 'ABC123', amount_minor: 50000,
    sender_number: null, occurred_at: null,
  });
});
