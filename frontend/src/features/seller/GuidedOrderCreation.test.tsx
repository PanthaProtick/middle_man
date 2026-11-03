import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AssistantWorkspace } from './AssistantWorkspace';
import { baseOrder } from './reviewAssistanceTestSupport';
import type { PaymentAccount } from './types';

let root: Root;
let host: HTMLDivElement;
const accounts: PaymentAccount[] = [{ id: 'account-1', shop_id: baseOrder.shop_id, provider: 'bkash',
  receiving_number: '01711223344', label: 'Main', is_active: true, version: 1, created_at: '', updated_at: '' }];
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
async function mount(availableAccounts = accounts) {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<AssistantWorkspace floating accounts={availableAccounts} token="seller"><p>Orders</p></AssistantWorkspace>));
  await click('Seller assistant');
  const language = host.querySelector<HTMLSelectElement>('[name="assistant-language"]')!;
  await act(async () => { language.value = 'en'; language.dispatchEvent(new Event('change', { bubbles: true })); });
}

it('collects locally, interprets bilingual amounts, and only creates after the explicit button', async () => {
  const requests: { url: string; options?: RequestInit }[] = [];
  const created = { ...baseOrder, lifecycle: 'awaiting_buyer', product_name: 'হাতের Shirt', total_minor: 125050 };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify(options?.method === 'POST' ? created : { storage_epoch: 'test' }));
  });
  await mount();
  await send('Create order; product: হাতের Shirt; total: ৳১,২৫০.৫০; advance: ২০০ টাকা; account: Main');
  expect(host.textContent).toContain('BDT 1,250.50');
  expect(host.textContent).toContain('Remaining COD (BDT): BDT 1,050.50');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-draft"]')?.value).toBe('হাতের Shirt');
  expect(requests).toHaveLength(0);
  await send('yes');
  expect(requests).toHaveLength(0);
  await change('assistant-total', '1500');
  expect(host.textContent).toContain('BDT 1,500.00');
  expect(host.textContent).toContain('Remaining COD (BDT): BDT 1,300.00');
  await click('Review'); await click('Confirm');
  const write = requests.find(request => request.options?.method === 'POST')!;
  expect(JSON.parse(String(write.options?.body))).toMatchObject({ product_name: 'হাতের Shirt', total_minor: 150000,
    required_advance_minor: 20000, payment_account_id: 'account-1' });
  expect(host.textContent).toContain('Awaiting buyer');
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Awaiting buyer');
  expect(host.textContent).toContain('Copy link');
  expect(host.textContent).toContain('Open order');
  expect(host.querySelector('a')?.href).toContain(created.portal_url);
});

it('preserves all valid answers and requests missing or ambiguous fields together', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await mount();
  await send('Create order; product: Shirt; total: 1,2; advance: 300');
  const missing = Array.from(host.querySelectorAll('.assistant-order-fields li')).map(item => item.textContent);
  expect(missing).toEqual(['Order total (BDT)', 'Receiving account']);
  expect(host.querySelector<HTMLInputElement>('[name="assistant-advance"]')?.value).toBe('300');
  await send('total: 200; account: Main');
  expect(host.querySelector('.assistant-order-fields ul')?.textContent).toBe('Required advance (BDT)');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-draft"]')?.value).toBe('Shirt');
  await send('advance: ৫০ টাকা');
  expect(host.textContent).toContain('BDT 50.00');
  await send('Create two orders; product: Other; total: 500');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-draft"]')?.value).toBe('Shirt');
  expect(host.querySelector('[role="log"]')?.textContent).toContain('one workflow');
  expect(fetcher).not.toHaveBeenCalled();
});

it('shows a localized zero remaining COD when the advance covers the total', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await mount();
  await send('Create order; product: Shirt; total: 200; advance: 200; account: Main');
  const language = host.querySelector<HTMLSelectElement>('[name="assistant-language"]')!;
  await act(async () => { language.value = 'bn'; language.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(host.textContent).toContain('বাকি ক্যাশ অন ডেলিভারি (BDT): BDT 0.00');
  expect(fetcher).not.toHaveBeenCalled();
});

it('resolves an unknown outcome before retrying, holding fields and one identity through close', async () => {
  const requests: { url: string; options?: RequestInit }[] = [];
  let posts = 0;
  let resolveLookup: (response: Response) => void = () => {};
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith('/order-submissions')) return new Response(JSON.stringify({ storage_epoch: 'test' }));
    if (options?.method === 'POST') {
      posts++;
      if (posts === 1) throw new TypeError('Lost response');
      return new Response(JSON.stringify({ ...baseOrder, lifecycle: 'awaiting_buyer' }));
    }
    return new Promise<Response>(resolve => { resolveLookup = resolve; });
  });
  await mount();
  await send('Create order; product: Shirt; total: 1000; advance: 200; account: Main');
  await click('Review'); await click('Confirm');
  expect(host.textContent).toContain('Outcome unknown');
  expect(host.querySelector('[name="assistant-total"]')).toBeNull();
  expect(Array.from(host.querySelectorAll('button')).find(item => item.textContent === 'Make Changes')?.disabled).toBe(true);
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Close assistant"]')!.click());
  await click('Seller assistant');
  await click('Check submission');
  expect(host.textContent).toContain('Still processing');
  expect(posts).toBe(1);
  await act(async () => resolveLookup(new Response(JSON.stringify({ state: 'not_found', order: null }))));
  await click('Retry confirmed submission');
  const writes = requests.filter(request => request.options?.method === 'POST');
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
  expect(host.textContent).toContain('Awaiting buyer');
});

it('keeps an unknown action locked when recovery itself fails authorization', async () => {
  let writeCount = 0;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    if (String(url).endsWith('/order-submissions')) return new Response(JSON.stringify({ storage_epoch: 'test' }));
    if (options?.method === 'POST') { writeCount++; throw new TypeError('Lost response'); }
    return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Sign in' } }), { status: 401 });
  });
  await mount();
  await send('Create order; product: Shirt; total: 1000; advance: 200; account: Main');
  await click('Review'); await click('Confirm'); await click('Check submission');
  expect(host.textContent).toContain('Outcome unknown');
  expect(host.querySelector('[name="assistant-total"]')).toBeNull();
  expect(Array.from(host.querySelectorAll('button')).find(item => item.textContent === 'Make Changes')?.disabled).toBe(true);
  expect(writeCount).toBe(1);
});

it('does not guess between accounts and keeps parcel fields optional under existing limits', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await mount([...accounts, { ...accounts[0], id: 'account-2', label: 'Other' }]);
  await send('Create order; product: Shirt; total: 1000; advance: 200; account: bkash');
  expect(host.querySelector('.assistant-order-fields ul')?.textContent).toBe('Receiving account');
  await send('account: Other; weight: 1.2345; quantity: 1.5');
  expect(host.querySelector('.assistant-order-fields ul')?.textContent).toContain('Weight in kg (optional)');
  expect(host.querySelector('.assistant-order-fields ul')?.textContent).toContain('Quantity (optional)');
  await send('weight: ১.২৫; quantity: ২');
  expect(host.querySelector('.assistant-order-fields ul')).toBeNull();
  await change('assistant-weight', ''); await change('assistant-quantity', '');
  expect(host.querySelector('.assistant-order-fields ul')).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});

it('preserves fields on stale accounts and resolves a saved unknown result without a second write', async () => {
  let writes = 0;
  const saved = { ...baseOrder, lifecycle: 'awaiting_buyer' };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    if (String(url).endsWith('/order-submissions')) return new Response(JSON.stringify({ storage_epoch: 'test' }));
    if (options?.method === 'POST') {
      writes++;
      if (writes === 1) return new Response(JSON.stringify({ error: { code: 'PAYMENT_ACCOUNT_INACTIVE', message: 'Inactive' } }), { status: 422 });
      throw new TypeError('Lost saved response');
    }
    return new Response(JSON.stringify({ state: 'succeeded', order: saved }));
  });
  await mount();
  await send('Create order; product: Shirt; total: 1000; advance: 200; account: Main');
  await click('Review'); await click('Confirm');
  expect(host.textContent).toContain('Could not save');
  await click('Make Changes');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-draft"]')?.value).toBe('Shirt');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-total"]')?.disabled).toBe(false);
  await change('assistant-total', '1200');
  await click('Review'); await click('Confirm'); await click('Check submission');
  expect(writes).toBe(2);
  expect(host.textContent).toContain('Awaiting buyer');
  expect(host.querySelector('[name="assistant-draft"]')).toBeNull();
});

it('opens the actual seller order in a stable dialog and copies its returned buyer link', async () => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  const saved = { ...baseOrder, lifecycle: 'awaiting_buyer', product_name: 'Actual saved order' };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    if (String(url).endsWith('/order-submissions')) return new Response(JSON.stringify({ storage_epoch: 'test' }));
    if (options?.method === 'POST' || String(url).endsWith(`/orders/${saved.id}`)) return new Response(JSON.stringify(saved));
    return new Response(JSON.stringify({ items: [], events: [] }));
  });
  await mount();
  await send('Create order; product: Shirt; total: 1000; advance: 200; account: Main');
  await click('Review'); await click('Confirm'); await click('Copy link');
  expect(writeText).toHaveBeenCalledWith(new URL(saved.portal_url, window.location.origin).href);
  await click('Open order');
  expect(host.querySelector('dialog[open]')?.textContent).toContain('Actual saved order');
  expect(host.querySelectorAll('dialog[open]')).toHaveLength(1);
});

it('clarifies repeated same-workflow actions and confirms discard before creating another order', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await mount();
  await send('Create order; product: Shirt; total: 1000; advance: 200; account: Main; and create another order; product: Bag; total: 2000; advance: 300; account: Main');
  expect(host.querySelector('[name="assistant-draft"]')).toBeNull();
  expect(host.querySelector('[role="log"]')?.textContent).toContain('one workflow');
  await send('Create order; product: Shirt; total: 1000; advance: 200; account: Main');
  await send('Create another order; product: Bag');
  expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
  expect(host.querySelector<HTMLInputElement>('[name="assistant-draft"]')?.value).toBe('Shirt');
  await click('Keep Editing');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-total"]')?.value).toBe('1000');
  expect(fetcher).not.toHaveBeenCalled();
});
