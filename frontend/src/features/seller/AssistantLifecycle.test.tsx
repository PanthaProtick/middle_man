import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { AssistantWorkspace } from './AssistantWorkspace';
import { ReviewAssistant } from './ReviewAssistant';
import { baseOrder } from './reviewAssistanceTestSupport';

let root: Root;
let host: HTMLDivElement;
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  vi.restoreAllMocks(); document.body.innerHTML = ''; localStorage.clear();
});
async function click(label: string) {
  const button = Array.from(host.querySelectorAll('button')).find(item => item.textContent === label);
  expect(button, label).toBeDefined();
  await act(async () => button!.click());
}
async function mount() {
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<AssistantWorkspace floating token="seller" eligibleOrderIds={[baseOrder.id]}>
    <ReviewAssistant order={baseOrder} token="seller" />
  </AssistantWorkspace>));
  await click('Seller assistant');
}
async function send(value: string) {
  const input = host.querySelector<HTMLTextAreaElement>('[name="assistant-message"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click('Send');
}

it('keeps a draft or proceeds with the original typed workflow details after confirmation', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch');
  await mount(); await send('Create order; product: Shirt; total: 1200; advance: 200');
  await send('Record payment; Trx ID: PAY123; amount: 200');
  expect(host.querySelector('[role="alertdialog"]')?.textContent).toContain(
    'You have an unconfirmed draft in progress. Discard it and proceed?');
  await click('Keep Editing');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-draft"]')?.value).toBe('Shirt');
  await send('Record payment; Trx ID: PAY123; amount: 200');
  await click('Discard & Proceed');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-payment-trx"]')?.value).toBe('PAY123');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-payment-amount"]')?.value).toBe('200');
  expect(fetcher).not.toHaveBeenCalled();
});

it('opens contextual advice inside the chat and retains advice, history and draft on minimize', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
    order_id: baseOrder.id, order_version: 1, buyer_revision: 1, lifecycle: 'pending',
    context_token: 'current', source: 'local', condition: 'UNKNOWN_CAUSE', explanation: 'Check the buyer claim',
    reason_codes: [], facts: {}, suggested_actions: [], locale: 'en',
  })));
  await mount(); await send('Create order; product: Shirt; total: 1200; advance: 200');
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="ask-ai-button"]')!.click());
  expect(host.querySelector('.assistant-chat-feed [data-testid="review-assistant-panel"]')?.textContent).toContain('Check the buyer claim');
  expect(host.querySelector('[role="log"]')?.textContent).toContain('product: Shirt');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-draft"]')?.value).toBe('Shirt');
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Close assistant"]')!.click());
  await click('Seller assistant');
  expect(host.querySelector('.assistant-chat-feed [data-testid="review-assistant-panel"]')?.textContent).toContain('Check the buyer claim');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-draft"]')?.value).toBe('Shirt');
  await click('New Chat'); await click('Keep Editing');
  expect(host.querySelector('[role="log"]')?.textContent).toContain('product: Shirt');
  await click('New Chat'); await click('Discard & Proceed');
  expect(host.querySelector('[role="log"]')?.textContent).toBe('');
  expect(host.querySelector('[data-testid="review-assistant-panel"]')).toBeNull();
  expect(host.querySelector('[data-testid="assistant-workflow"]')).toBeNull();
  expect(host.textContent).toContain('Choose a workflow or tell me what you need.');
});

it.each([
  ['Create order; product: Shirt; total: 1200; advance: 200', 'Create new order; product: Shoes; total: 900', 'assistant-draft', 'Shirt', 'Shoes'],
  ['Record payment; trx id: FIRST; amount: 200', 'Record new payment; trx id: SECOND; amount: 300', 'assistant-payment-trx', 'FIRST', 'SECOND'],
  ['Create order; product: Shirt; total: 1200; advance: 200', 'another order; product: Shoes; total: 900', 'assistant-draft', 'Shirt', 'Shoes'],
  ['Record payment; trx id: FIRST; amount: 200', 'another payment; trx id: SECOND; amount: 300', 'assistant-payment-trx', 'FIRST', 'SECOND'],
])('protects an existing creation draft from a replacement: %s', async (initial, replacement, field, before, after) => {
  await mount(); await send(initial); await send(replacement);
  expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
  expect(host.querySelector<HTMLInputElement>(`[name="${field}"]`)?.value).toBe(before);
  await click('Keep Editing');
  expect(host.querySelector<HTMLInputElement>(`[name="${field}"]`)?.value).toBe(before);
  await send(replacement); await click('Discard & Proceed');
  expect(host.querySelector<HTMLInputElement>(`[name="${field}"]`)?.value).toBe(after);
});
