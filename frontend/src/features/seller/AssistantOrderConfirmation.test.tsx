import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AssistantWorkspace } from './AssistantWorkspace';
import { baseOrder } from './reviewAssistanceTestSupport';
import type { PaymentAccount } from './types';

let root: Root;
let host: HTMLDivElement;
const accounts: PaymentAccount[] = [{ id: 'acc-1', shop_id: baseOrder.shop_id, provider: 'bkash',
  receiving_number: '01711223344', label: 'Main', is_active: true, version: 1, created_at: '', updated_at: '' }];
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  vi.restoreAllMocks(); vi.useRealTimers(); document.body.innerHTML = ''; localStorage.clear();
});
function button(label: string) {
  const found = Array.from(host.querySelectorAll('button')).find(item =>
    item.textContent === label || (label === 'Seller assistant' && item.dataset.testid === 'seller-assistant-launcher')
  );
  expect(found, label).toBeDefined(); return found!;
}
async function click(label: string) { await act(async () => button(label).click()); }
function field(name: string) {
  return host.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="assistant-${name}"]`)!;
}
async function change(name: string, value: string) {
  const input = field(name);
  await act(async () => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
}
async function send(message: string) {
  await change('message', message);
  await act(async () => field('message').form!.requestSubmit());
}
async function mount() {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<AssistantWorkspace floating accounts={accounts} token="seller"><p>Orders</p></AssistantWorkspace>));
  await click('Seller assistant'); await change('language', 'en');
  await send('Create order; product: Shirt; total: 1500; advance: 300; account: Main; weight: 0.75; quantity: 2');
}

it('reviews without saving and reopens every entered field in the same card', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await mount(); await click('Review');
  expect(field('draft')).toBeNull();
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Ready to create');
  const card = host.querySelector('[data-testid="assistant-workflow"]');
  expect(card?.textContent).toContain('BDT 1,500.00');
  expect(card?.textContent).toContain('BDT 300.00');
  expect(card?.textContent).toContain('BDT 1,200.00');
  expect(card?.textContent).toContain('Main · bkash · 01711223344');
  expect(button('Confirm').disabled).toBe(false);
  await send('yes');
  expect(fetcher).not.toHaveBeenCalled();
  await click('Make Changes');
  expect(document.activeElement).toBe(field('draft'));
  for (const [name, value] of Object.entries({ draft: 'Shirt', total: '1500', advance: '300',
    account: 'acc-1', weight: '0.75', quantity: '2' })) expect(field(name).value).toBe(value);
  expect(host.querySelector('[data-testid="assistant-workflow"]')).toBe(card);
  expect(host.querySelectorAll('[data-testid="assistant-workflow"]')).toHaveLength(1);
  await change('advance', '2000');
  expect(button('Review').disabled).toBe(true);
  expect(fetcher).not.toHaveBeenCalled();
});

it('saves once, retains the returned terms in the timeline, copies the link, and opens the current order', async () => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeText);
  const saved = { ...baseOrder, product_name: 'Saved Shirt', total_minor: 150000,
    required_advance_minor: 30000, expected_cod_minor: 120000, lifecycle: 'awaiting_buyer' };
  const requests: { url: string; options?: RequestInit }[] = [];
  let finish: (response: Response) => void = () => {};
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    requests.push({ url: String(url), options });
    if (options?.method === 'POST') return new Promise<Response>(resolve => { finish = resolve; });
    if (String(url).endsWith('/order-submissions')) return new Response(JSON.stringify({ storage_epoch: 'test' }));
    if (String(url).endsWith(`/orders/${saved.id}`)) return new Response(JSON.stringify({ ...saved, product_name: 'Current Shirt' }));
    return new Response(JSON.stringify({ items: [], events: [] }));
  });
  await mount(); await click('Review');
  await act(async () => { button('Confirm').click(); button('Confirm').click(); });
  expect(button('Confirm').disabled).toBe(true);
  expect(button('Make Changes').disabled).toBe(true);
  expect(host.querySelector('[aria-busy="true"]')).not.toBeNull();
  expect(host.textContent).toContain('Still processing');
  expect(requests.filter(request => request.options?.method === 'POST')).toHaveLength(1);
  expect(JSON.parse(String(requests.find(request => request.options?.method === 'POST')?.options?.body))).toMatchObject({
    product_name: 'Shirt', total_minor: 150000, required_advance_minor: 30000,
    payment_account_id: 'acc-1', parcel_weight_grams: 750, parcel_quantity: 2,
  });
  await act(async () => finish(new Response(JSON.stringify(saved))));
  const result = host.querySelector('[role="log"] .assistant-result');
  expect(result?.textContent).toContain('Saved Shirt');
  expect(result?.textContent).toContain(saved.id);
  for (const amount of ['BDT 1,500.00', 'BDT 300.00', 'BDT 1,200.00']) expect(result?.textContent).toContain(amount);
  expect(field('draft')).toBeNull();
  const link = new URL(saved.portal_url, window.location.origin).href;
  expect(result?.querySelector('a')?.href).toBe(link);
  vi.useFakeTimers(); await click('Copy link');
  expect(writeText).toHaveBeenCalledWith(link);
  expect(result?.textContent).toContain('Copied');
  await act(async () => vi.advanceTimersByTime(3000));
  expect(result?.textContent).not.toContain('Copied');
  vi.useRealTimers();
  await click('New order');
  expect(field('draft').value).toBe('');
  await change('draft', 'Next item');
  expect(host.querySelector('[role="log"] .assistant-result')).toBe(result);
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Close assistant"]')!.click());
  await click('Seller assistant');
  expect(host.querySelectorAll('[role="log"] .assistant-result')).toHaveLength(1);
  await click('Open order');
  expect(host.querySelector('dialog[open]')?.textContent).toContain('Current Shirt');
  expect(host.querySelector('[role="log"] .assistant-result')?.textContent).toContain('Saved Shirt');
});

it.each([['en', 'Review', 'Confirm', 'Make Changes', 'Could not save'],
  ['bn', 'পর্যালোচনা করুন', 'নিশ্চিত করুন', 'পরিবর্তন করুন', 'সংরক্ষণ হয়নি']])(
  'preserves the reviewed draft after a definitive failure in %s and retries only on confirmation',
  async (locale, review, confirm, changes, failure) => {
    let posts = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, options) => {
      if (options?.method !== 'POST') return new Response(JSON.stringify({ storage_epoch: 'test' }));
      posts++;
      if (posts === 1) return new Response(JSON.stringify({ error: { code: 'PAYMENT_ACCOUNT_INACTIVE', message: 'Inactive' } }), { status: 422 });
      return new Response(JSON.stringify({ ...baseOrder, product_name: 'Corrected Shirt' }));
    });
    await mount(); await change('language', locale); await click(review); await click(confirm);
    expect(host.textContent).toContain(failure);
    expect(host.querySelector('.assistant-order-fields')?.textContent).toContain('Shirt');
    await click(changes);
    expect(field('draft').value).toBe('Shirt'); expect(field('total').value).toBe('1500');
    await change('draft', 'Corrected Shirt'); await click(review);
    expect(posts).toBe(1);
    await click(confirm);
    expect(posts).toBe(2);
    expect(host.querySelector('[role="log"] .assistant-result')?.textContent).toContain('Corrected Shirt');
  });

it('returns conversational corrections to editing so changed terms require review again', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await mount(); await click('Review'); await send('total: 1700');
  expect(field('total').value).toBe('1700');
  expect(Array.from(host.querySelectorAll('button')).some(item => item.textContent === 'Confirm')).toBe(false);
  await click('Review');
  expect(host.querySelector('.assistant-order-fields')?.textContent).toContain('BDT 1,700.00');
  expect(fetcher).not.toHaveBeenCalled();
});

it('retains multiple order results until New Chat and leaves the link usable when copy or opening fails', async () => {
  let posts = 0;
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Denied'));
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    if (options?.method === 'POST') {
      posts++;
      return new Response(JSON.stringify({ ...baseOrder, id: `saved-${posts}`, product_name: `Saved ${posts}` }));
    }
    if (String(url).endsWith('/order-submissions')) return new Response(JSON.stringify({ storage_epoch: 'test' }));
    return new Response('{}', { status: 503 });
  });
  await mount(); await click('Review'); await click('Confirm');
  await click('Copy link');
  expect(host.textContent).toContain('Copy failed. Select the link to copy it.');
  expect(host.querySelector('[role="log"] a')?.getAttribute('href')).toContain(baseOrder.portal_url);
  await click('Open order');
  expect(host.querySelector('[role="log"] [role="alert"]')).not.toBeNull();
  expect(button('Open order').disabled).toBe(false);
  await send('Create order; product: Second; total: 2000; advance: 400; account: Main');
  await click('Review'); await click('Confirm');
  const results = Array.from(host.querySelectorAll('[role="log"] .assistant-result'));
  expect(results).toHaveLength(2);
  expect(results[0].textContent).toContain('Saved 1'); expect(results[1].textContent).toContain('Saved 2');
  await click('New Chat');
  expect(host.querySelectorAll('[role="log"] .assistant-result')).toHaveLength(0);
  expect(posts).toBe(2);
});
