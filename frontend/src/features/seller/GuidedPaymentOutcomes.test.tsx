import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AssistantWorkspace } from './AssistantWorkspace';
import { baseOrder } from './reviewAssistanceTestSupport';
import type { PaymentAccount, ReceiptView } from './types';

let root: Root;
let host: HTMLDivElement;
const accounts: PaymentAccount[] = [{
  id: 'account-1', shop_id: 'shop-1', provider: 'bkash', receiving_number: '01711223344',
  label: 'Main', is_active: true, version: 1, created_at: '', updated_at: '',
}];
const observation = (overrides: Partial<ReceiptView['observations'][number]> = {}) => ({
  id: 'observation-1', transaction_id: 'receipt-1', payment_account_id: 'account-1', source: 'manual',
  provider: 'bkash' as const, trx_id: 'EXACT-1', actor: 'seller', amount_minor: 10000,
  parse_state: 'incomplete' as const, conflict_state: 'none' as const, created_at: '', ...overrides,
});
const receipt = (overrides: Partial<ReceiptView> = {}): ReceiptView => ({
  id: 'receipt-1', shop_id: 'shop-1', payment_account_id: 'account-1', provider: 'bkash',
  trx_id: 'EXACT-1', amount_minor: 10000, reconciliation_state: 'unmatched', has_conflict: false,
  version: 1, created_at: '', updated_at: '', related_claims_count: 0,
  observations: [observation()], ...overrides,
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
  const input = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function send(message: string) {
  await change('assistant-message', message);
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
async function mount() {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<AssistantWorkspace floating accounts={accounts} token="seller"><p>Orders</p></AssistantWorkspace>));
  await click('Seller assistant');
  const language = host.querySelector<HTMLSelectElement>('[name="assistant-language"]')!;
  await act(async () => { language.value = 'en'; language.dispatchEvent(new Event('change', { bubbles: true })); });
}
async function draftPayment() {
  await send('Record payment; account: Main; trx id: EXACT-1; amount: 100');
}

it('resolves a lost response through the same identity without a second write', async () => {
  const writes: RequestInit[] = [];
  let lookups = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    if (String(url).endsWith('/transaction-submissions')) return new Response(JSON.stringify({ storage_epoch: 'epoch' }));
    if (options?.method === 'POST') { writes.push(options); throw new TypeError('Lost response'); }
    lookups++;
    return new Response(JSON.stringify({ state: 'succeeded', result: { receipt: receipt(), allocated_order_ids: [] } }));
  });
  await mount();
  await draftPayment();
  await click('Review'); await click('Confirm');
  expect(host.textContent).toContain('Outcome unknown');
  expect(host.querySelector('[name="assistant-payment-trx"]')).toBeNull();
  await click('Check submission');
  expect(writes).toHaveLength(1);
  expect(lookups).toBe(1);
  expect(host.textContent).toContain('Payment recorded');
  expect(host.querySelector('[name="assistant-payment-trx"]')).toBeNull();
});

it('retries the same confirmed identity only after recovery finds no saved result', async () => {
  const writes: { url: string; options?: RequestInit }[] = [];
  let lookup = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    if (String(url).endsWith('/transaction-submissions')) return new Response(JSON.stringify({ storage_epoch: 'epoch' }));
    if (options?.method === 'POST') {
      writes.push({ url: String(url), options });
      if (writes.length === 1) throw new TypeError('Lost response');
      return new Response(JSON.stringify({ receipt: receipt(), allocated_order_ids: [] }));
    }
    lookup++;
    return new Response(JSON.stringify({ state: 'not_found', result: null }));
  });
  await mount();
  await draftPayment();
  await click('Review'); await click('Confirm'); await click('Check submission');
  expect(host.textContent).toContain('No saved result found');
  await click('Retry confirmed submission');
  expect(writes).toHaveLength(2);
  expect(writes[0].url).toBe(writes[1].url);
  expect(writes[0].options?.body).toBe(writes[1].options?.body);
  expect(lookup).toBe(1);
});

it('submits once while the explicit action is processing even if it is clicked again', async () => {
  let release: (response: Response) => void = () => {};
  let writes = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    if (String(url).endsWith('/transaction-submissions')) return new Response(JSON.stringify({ storage_epoch: 'epoch' }));
    if (options?.method === 'POST') {
      writes++;
      return new Promise<Response>(resolve => { release = resolve; });
    }
    return new Response(JSON.stringify({ state: 'not_found', result: null }));
  });
  await mount();
  await draftPayment();
  await click('Review'); await click('Confirm');
  await click('Confirm');
  expect(writes).toBe(1);
  await act(async () => release(new Response(JSON.stringify({ receipt: receipt(), allocated_order_ids: [] }))));
  expect(host.textContent).toContain('Payment recorded');
});

it('reports preserved conflict and identical duplicate evidence without inventing confirmation', async () => {
  let response = receipt({ has_conflict: true, reconciliation_state: 'conflicted',
    observations: [observation(), observation({ id: 'observation-2', conflict_state: 'conflicting', amount_minor: 99999 })] });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    if (String(url).endsWith('/transaction-submissions')) return new Response(JSON.stringify({ storage_epoch: 'epoch' }));
    return new Response(JSON.stringify({ receipt: response, allocated_order_ids: [] }));
  });
  await mount();
  await draftPayment(); await click('Review'); await click('Confirm');
  expect(host.textContent).toContain('Conflicting evidence');
  expect(host.textContent).not.toContain('Reconciliation confirmed order');
  response = receipt({ observations: [observation(), observation({ id: 'observation-2', conflict_state: 'identical' })] });
  await click('Record a payment');
  await send('Record payment; account: Main; trx id: EXACT-2; amount: 100'); await click('Review'); await click('Confirm');
  expect(host.textContent).toContain('This exact evidence was already recorded');
  expect(host.textContent).not.toContain('Reconciliation confirmed order');
});

it('shows the actual confirmed order and opens the fetched seller order', async () => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
  const confirmed = { ...baseOrder, lifecycle: 'confirmed', actual_cod_minor: 1000000, product_name: 'Actual confirmed order' };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    if (String(url).endsWith('/transaction-submissions')) return new Response(JSON.stringify({ storage_epoch: 'epoch' }));
    if (options?.method === 'POST') {
      return new Response(JSON.stringify({
        receipt: receipt({ reconciliation_state: 'used',
          observations: [observation(), observation({ id: 'observation-2', conflict_state: 'identical' })] }),
        allocated_order_ids: [confirmed.id],
      }));
    }
    if (String(url).endsWith(`/orders/${confirmed.id}`)) return new Response(JSON.stringify(confirmed));
    return new Response(JSON.stringify({ items: [], events: [] }));
  });
  await mount();
  await draftPayment(); await click('Review'); await click('Confirm');
  expect(host.textContent).toContain('Reconciliation confirmed order');
  await click('Open order');
  expect(host.querySelector('dialog[open]')?.textContent).toContain('Actual confirmed order');
});

it('keeps edited fields after a stale account and stays locked after a failed recovery', async () => {
  let writes = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    if (String(url).endsWith('/transaction-submissions')) return new Response(JSON.stringify({ storage_epoch: 'epoch' }));
    if (options?.method === 'POST') {
      writes++;
      if (writes === 1) return new Response(JSON.stringify({ error: { code: 'PAYMENT_ACCOUNT_INACTIVE', message: 'Inactive' } }), { status: 422 });
      throw new TypeError('Lost response');
    }
    return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Sign in' } }), { status: 401 });
  });
  await mount();
  await draftPayment(); await click('Review'); await click('Confirm');
  expect(host.textContent).toContain('inactive');
  await click('Make Changes');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-payment-trx"]')?.value).toBe('EXACT-1');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-payment-trx"]')?.disabled).toBe(false);
  await change('assistant-payment-amount', '200');
  await click('Review'); await click('Confirm');
  expect(writes).toBe(2);
  expect(host.textContent).toContain('Outcome unknown');
  await click('Check submission');
  expect(host.textContent).toContain('Outcome unknown');
  expect(host.textContent).toContain('Your seller session is unavailable');
  expect(host.querySelector('[name="assistant-payment-amount"]')).toBeNull();
  expect(Array.from(host.querySelectorAll('button')).find(item => item.textContent === 'Make Changes')?.disabled).toBe(true);
});
