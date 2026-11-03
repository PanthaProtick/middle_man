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
  await act(async () => root.render(<AssistantWorkspace floating eligibleOrderIds={[baseOrder.id]}>
    <ReviewAssistant order={baseOrder} token="seller" />
  </AssistantWorkspace>));
  await click('Seller assistant'); await click('New order');
  const input = host.querySelector<HTMLInputElement>('[name="assistant-draft"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'হাতের কাজ Shirt');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

it('keeps one draft through close, searches, and review, and confirms switching creation workflows', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    order_id: baseOrder.id, order_version: 1, buyer_revision: 1, lifecycle: 'pending',
    context_token: 'current', source: 'local', condition: 'UNKNOWN_CAUSE', explanation: 'Current advice',
    reason_codes: [], facts: {}, suggested_actions: [], locale: 'en',
  })));
  await mount();
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Close assistant"]')!.click());
  await click('Seller assistant');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-draft"]')?.value).toBe('হাতের কাজ Shirt');
  await click('Orders needing attention');
  expect(host.textContent).toContain('Unfinished draft');
  await click('Resume draft');
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="ask-ai-button"]')!.click());
  expect(host.querySelectorAll('[data-testid="review-assistant-panel"]')).toHaveLength(1);
  const windowHeader = host.querySelector('.assistant-window-header')!;
  const review = host.querySelector('.review-assistant-side-panel')!;
  expect(windowHeader.compareDocumentPosition(review) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const language = host.querySelector<HTMLSelectElement>('[name="assistant-language"]')!;
  await act(async () => { language.value = 'bn'; language.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(review.getAttribute('lang')).toBe('bn');
  await act(async () => { language.value = 'en'; language.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(host.querySelector('[name="assistant-draft"]')).toBeNull();
  await click('Guided workflows');
  expect(host.querySelector('[data-testid="review-assistant-panel"]')).toBeNull();
  expect(host.querySelector<HTMLInputElement>('[name="assistant-draft"]')?.value).toBe('হাতের কাজ Shirt');
  await click('Record a payment');
  expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
  await click('Keep draft');
  expect(host.querySelector<HTMLInputElement>('[name="assistant-draft"]')?.value).toBe('হাতের কাজ Shirt');
  await click('Record a payment');
  await act(async () => host.querySelector<HTMLButtonElement>('[role="alertdialog"] .btn-danger')!.click());
  expect(host.querySelector<HTMLInputElement>('[name="assistant-payment-trx"]')?.value).toBe('');
  expect(host.querySelector('[data-testid="assistant-workflow"]')?.textContent).toContain('Transaction ID');
});

it('requires confirmation for reset and discard, restores focus, and clears on a new shop lifetime', async () => {
  await mount();
  await click('New conversation');
  expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
  await click('Keep draft');
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await act(async () => new Promise(requestAnimationFrame));
  expect(document.activeElement).toBe(host.querySelector('[data-testid="seller-assistant-launcher"]'));
  await click('Seller assistant'); await click('Discard draft');
  expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
  await act(async () => host.querySelector<HTMLButtonElement>('[role="alertdialog"] .btn-danger')!.click());
  expect(host.querySelector('[name="assistant-draft"]')).toBeNull();
  await click('New order'); await click('New conversation');
  await act(async () => host.querySelector<HTMLButtonElement>('[role="alertdialog"] .btn-danger')!.click());
  expect(host.querySelector('[data-testid="assistant-workflow"]')).toBeNull();
  await click('New order');
  await act(async () => root.render(<AssistantWorkspace key="next-shop" floating><p>Other shop</p></AssistantWorkspace>));
  await click('Seller assistant');
  expect(host.querySelector('[name="assistant-draft"]')).toBeNull();
  expect(host.querySelector('[role="log"]')?.textContent).toBe('');
  expect(localStorage.length).toBe(0);
});

it('preserves unsent text on close and clears it only when a new conversation is confirmed', async () => {
  await mount();
  const input = host.querySelector<HTMLTextAreaElement>('[name="assistant-message"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'Unsaved question');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Close assistant"]')!.click());
  await click('Seller assistant');
  expect(host.querySelector<HTMLTextAreaElement>('[name="assistant-message"]')?.value).toBe('Unsaved question');
  await click('New conversation');
  await act(async () => host.querySelector<HTMLButtonElement>('[role="alertdialog"] .btn-danger')!.click());
  expect(host.querySelector<HTMLTextAreaElement>('[name="assistant-message"]')?.value).toBe('');
});
