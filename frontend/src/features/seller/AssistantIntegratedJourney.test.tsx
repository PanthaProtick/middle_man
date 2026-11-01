import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AssistantWorkspace } from './AssistantWorkspace';
import { ReviewAssistant } from './ReviewAssistant';
import { baseOrder } from './reviewAssistanceTestSupport';
import type { PaymentAccount } from './types';

let root: Root;
let host: HTMLDivElement;
const accounts: PaymentAccount[] = [{ id: 'acc-1', shop_id: baseOrder.shop_id, provider: 'bkash',
  receiving_number: '01700000000', label: 'Main', is_active: true, version: 1, created_at: '', updated_at: '' }];
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

it('keeps editable order terms through both searches and contextual review before explicit creation', async () => {
  const writes: RequestInit[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
    const path = String(url);
    if (path.includes('/order-submissions/') && options?.method === 'POST') {
      writes.push(options);
      return new Response(JSON.stringify({ ...baseOrder, ...JSON.parse(String(options.body)), lifecycle: 'awaiting_buyer' }));
    }
    if (path.includes('/work-queries/')) return new Response(JSON.stringify({
      items: [], total: 0, next_cursor: null, retrieved_at: '2026-11-01T06:00:00Z',
      calendar_date: '2026-11-01', timezone: 'Asia/Dhaka',
    }));
    if (path.includes('review-assistance')) return new Response(JSON.stringify({
      order_id: baseOrder.id, order_version: 1, buyer_revision: 1, lifecycle: 'pending',
      context_token: 'current', source: 'local', condition: 'UNKNOWN_CAUSE', explanation: 'Local advice',
      reason_codes: [], facts: {}, suggested_actions: [], locale: 'en',
    }));
    if (path.endsWith('/order-submissions')) return new Response(JSON.stringify({ storage_epoch: 'synthetic' }));
    throw new Error(`Unexpected request: ${path}`);
  });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<AssistantWorkspace floating accounts={accounts} token="seller" eligibleOrderIds={[baseOrder.id]}>
    <ReviewAssistant order={baseOrder} token="seller" />
  </AssistantWorkspace>));
  await click('Seller assistant');
  await change('assistant-message', 'Create order; product: Mixed শার্ট; total: 1250.50; advance: 200; account: Main');
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  const language = host.querySelector<HTMLSelectElement>('[name="assistant-language"]')!;
  await act(async () => { language.value = 'en'; language.dispatchEvent(new Event('change', { bubbles: true })); });
  await change('assistant-weight', '0.75'); await change('assistant-quantity', '2');
  for (const query of ['Orders needing attention', 'Awaiting delivery preparation']) {
    await click(query);
    expect(host.querySelectorAll('.seller-assistant-window')).toHaveLength(1);
    expect(host.textContent).toContain('Unfinished draft');
  }
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="ask-ai-button"]')!.click());
  expect(host.querySelectorAll('[data-testid="review-assistant-panel"]')).toHaveLength(1);
  expect(host.querySelectorAll('.seller-assistant-window')).toHaveLength(1);
  await click('Guided workflows'); await click('Resume draft');
  for (const [name, value] of Object.entries({ 'assistant-draft': 'Mixed শার্ট', 'assistant-total': '1250.50',
    'assistant-advance': '200', 'assistant-weight': '0.75', 'assistant-quantity': '2', 'assistant-account': 'acc-1' })) {
    expect(host.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value).toBe(value);
  }
  expect(writes).toHaveLength(0);
  await change('assistant-total', '1500'); await click('Create order');
  expect(writes).toHaveLength(1);
  expect(JSON.parse(String(writes[0].body))).toMatchObject({ product_name: 'Mixed শার্ট', total_minor: 150000,
    required_advance_minor: 20000, parcel_weight_grams: 750, parcel_quantity: 2, payment_account_id: 'acc-1' });
  expect(document.activeElement?.getAttribute('aria-label')).toBe('Awaiting buyer');
});
