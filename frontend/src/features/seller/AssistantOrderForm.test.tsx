import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AssistantWorkspace } from './AssistantWorkspace';
import type { PaymentAccount } from './types';

let root: Root;
let host: HTMLDivElement;
const accounts: PaymentAccount[] = [{ id: 'active', shop_id: 'shop', provider: 'bkash',
  receiving_number: '01711223344', label: 'Main', is_active: true, version: 1, created_at: '', updated_at: '' },
{ id: 'inactive', shop_id: 'shop', provider: 'nagad', receiving_number: '01811223344',
  label: 'Old', is_active: false, version: 1, created_at: '', updated_at: '' }];

afterEach(async () => {
  if (root) await act(async () => root.unmount());
  vi.restoreAllMocks(); document.body.innerHTML = ''; localStorage.clear();
});
async function mount() {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<AssistantWorkspace floating accounts={accounts}><p>Orders</p></AssistantWorkspace>));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="seller-assistant-launcher"]')!.click());
}
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
  await act(async () => field('message').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
}

it.each([
  ['Create order for 1500 taka silk saree, advance 300', 'silk saree', '1500', '300'],
  ['১৫০০ টাকার সিল্ক শাড়ি অর্ডার তৈরি করুন, অগ্রিম ৩০০', 'সিল্ক শাড়ি', '১৫০০', '৩০০'],
  ['notun order for 1500 taka silk saree, ogrim 300', 'silk saree', '1500', '300'],
])('opens an editable inline draft from %s without making a request', async (message, product, total, advance) => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await mount(); await send(message);
  expect(host.querySelector('.assistant-chat-feed [data-testid="assistant-workflow"]')).not.toBeNull();
  expect(field('draft').value).toBe(product);
  expect(field('total').value).toBe(total);
  expect(field('advance').value).toBe(advance);
  expect(field('account').value).toBe('');
  expect(field('account').disabled).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
});

it('starts empty from New order and validates direct edits against active accounts', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await mount(); await change('language', 'en');
  const chip = Array.from(host.querySelectorAll<HTMLButtonElement>('.assistant-workflow-choices button'))
    .find(button => button.textContent === 'New order');
  expect(chip).toBeDefined();
  await act(async () => chip!.click());
  for (const name of ['draft', 'total', 'advance', 'account', 'weight', 'quantity']) expect(field(name).value).toBe('');
  expect(field('account').querySelector('[value="inactive"]')).toBeNull();
  await change('draft', 'Edited saree'); await change('total', '1500');
  await change('advance', '0');
  expect(field('advance').getAttribute('aria-invalid')).toBe('true');
  await change('advance', '1501');
  expect(field('advance').getAttribute('aria-invalid')).toBe('true');
  await change('advance', '300');
  expect(field('advance').getAttribute('aria-invalid')).toBe('false');
  expect(field('account').getAttribute('aria-invalid')).toBe('true');
  await change('account', 'active'); await change('weight', '১.২৫'); await change('quantity', '২');
  expect(host.querySelector('.assistant-order-fields ul')).toBeNull();
  expect(host.textContent).toContain('Remaining COD (BDT): BDT 1,200.00');
  await change('weight', '0');
  expect(field('weight').getAttribute('aria-invalid')).toBe('true');
  expect(fetcher).not.toHaveBeenCalled();
});

it('keeps ambiguous amounts invalid and preserves labeled corrections and product digits', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await mount(); await change('language', 'en');
  await send('Create order for Shirt 2026, total 1,2 taka, advance 100 and advance 200');
  expect(field('draft').value).toBe('Shirt 2026');
  expect(field('total').value).toBe('1,2');
  expect(field('total').getAttribute('aria-invalid')).toBe('true');
  expect(field('advance').value).toBe('');
  await send('total: 1500; advance: 300; account: Main');
  expect(field('draft').value).toBe('Shirt 2026');
  expect(host.querySelector('.assistant-order-fields ul')).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});

it('leaves the product blank when a creation message only gives a price', async () => {
  await mount();
  await send('Create order for 1500 taka, advance 300');
  expect(field('draft').value).toBe('');
  expect(field('total').value).toBe('1500');
  expect(field('advance').value).toBe('300');
});

it.each([',advance 300', ' advance 300'])('keeps amount clauses out of the product without spaced punctuation: %s', async suffix => {
  await mount();
  await send(`Create order for 1,500 taka silk saree${suffix}`);
  expect(field('draft').value).toBe('silk saree');
  expect(field('total').value).toBe('1,500');
  expect(field('advance').value).toBe('300');
});

it('requires correction when repeated amount cues conflict with an existing valid draft or price', async () => {
  await mount(); await change('language', 'en');
  await send('Create order; product: Shirt; total: 1500; advance: 300; account: Main');
  await send('advance 100 and advance 200');
  expect(field('advance').value).toBe('');
  expect(field('advance').getAttribute('aria-invalid')).toBe('true');
  expect(host.querySelector('.assistant-order-fields section')).toBeNull();
  await send('Create order for 1500 taka silk saree, total 2000 and total 3000');
  expect(field('total').value).toBe('');
  expect(field('total').getAttribute('aria-invalid')).toBe('true');
});
