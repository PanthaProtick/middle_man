import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { OrderList } from './OrderList';
import { baseOrder } from './reviewAssistanceTestSupport';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; localStorage.clear(); });

it('keeps one side panel outside cards, switches orders and returns focus on Escape', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const id = String(url).includes('order-2') ? 'order-2' : baseOrder.id;
    return new Response(JSON.stringify({order_id: id, order_version: 1, buyer_revision: 1,
      lifecycle: 'pending', context_token: id, source: 'local', condition: 'UNKNOWN_CAUSE',
      explanation: `Guidance for ${id}`, reason_codes: [], facts: {}, suggested_actions: [], locale: 'en'}));
  });
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<OrderList orders={[baseOrder, {...baseOrder, id: 'order-2'}]}
    token="seller" statusFilter="" onFilterChange={() => undefined} nextCursor={null} onLoadMore={() => undefined} />));
  const triggers = host.querySelectorAll<HTMLButtonElement>('[data-testid="ask-ai-button"]');
  await act(async () => triggers[0].click());
  expect(host.querySelector('.isolated-subcard [data-testid="review-assistant-panel"]')).toBeNull();
  expect(host.querySelector('[data-testid="review-assistant-panel"]')?.textContent).toContain('order-1');
  await act(async () => triggers[1].click());
  expect(host.querySelectorAll('[data-testid="review-assistant-panel"]')).toHaveLength(1);
  expect(host.querySelector('[data-testid="review-assistant-panel"]')?.textContent).toContain('order-2');
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true})));
  expect(host.querySelector('[data-testid="review-assistant-panel"]')).toBeNull();
  await act(async () => new Promise(requestAnimationFrame));
  expect(document.activeElement).toBe(triggers[1]);
  expect(fetcher.mock.calls.every(([, init]) => !String(init?.body).includes('"generate":true'))).toBe(true);
  await act(async () => root.unmount());
});

it('moves an open assistant into order details and dismisses it before the dialog', async () => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true; });
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false; });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async url => new Response(JSON.stringify(
    String(url).includes('review-assistance') ? {
      order_id: baseOrder.id, order_version: 1, buyer_revision: 1, lifecycle: 'pending',
      context_token: 'current', source: 'local', condition: 'UNKNOWN_CAUSE', explanation: 'Current advice',
      reason_codes: [], facts: {}, suggested_actions: [], locale: 'en',
    } : (/transactions|history/.test(String(url))) ? {items: [], next_cursor: null} : baseOrder)));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<OrderList orders={[baseOrder]} token="seller" statusFilter=""
    onFilterChange={() => undefined} nextCursor={null} onLoadMore={() => undefined} />));
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="ask-ai-button"]')!.click());
  const inspect = host.querySelector<HTMLButtonElement>('.isolated-subcard button')!;
  await act(async () => inspect.click());
  const dialog = host.querySelector('dialog')!;
  expect(dialog.querySelector('[data-testid="review-assistant-panel"]')).not.toBeNull();
  expect(host.querySelectorAll('[data-testid="review-assistant-panel"]')).toHaveLength(1);
  expect(dialog.querySelector('.review-assistant-side-panel')?.closest('[hidden]')).toBeNull();
  await act(async () => dialog.querySelector<HTMLButtonElement>('.assistant-back')!.click());
  expect(dialog.open).toBe(true);
  expect(host.querySelector('[data-testid="review-assistant-panel"]')).toBeNull();
  expect(document.activeElement?.getAttribute('role')).toBe('tab');
  await act(async () => dialog.querySelector<HTMLButtonElement>('[id$="-payment-tab"]')!.click());
  await act(async () => dialog.querySelector<HTMLButtonElement>('[data-testid="ask-ai-button"]')!.click());
  await act(async () => dialog.dispatchEvent(new Event('cancel', {cancelable: true})));
  expect(host.querySelector('dialog')).toBe(dialog);
  expect(dialog.querySelector('[data-testid="review-assistant-panel"]')).toBeNull();
  await act(async () => new Promise(requestAnimationFrame));
  expect(document.activeElement).toBe(dialog.querySelector('[data-testid="ask-ai-button"]'));
  await act(async () => dialog.dispatchEvent(new Event('cancel', {cancelable: true})));
  expect(host.querySelector('dialog')).toBeNull();
  await act(async () => root.unmount());
});


it('reloads open guidance on fact changes and discards advice from an older order context', async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }))
    .mockImplementation(async url => new Response(JSON.stringify({
      order_id: String(url).includes('order-2') ? 'order-2' : baseOrder.id,
      order_version: 2, buyer_revision: 1, lifecycle: 'pending', context_token: 'fresh', source: 'local',
      condition: 'UNKNOWN_CAUSE', explanation: 'Fresh advice', reason_codes: [], facts: {}, suggested_actions: [], locale: 'en',
    })));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const render = async (version: number) => act(async () => root.render(<OrderList
    orders={[{...baseOrder, version}, {...baseOrder, id: 'order-2', version: 2}]} token="seller" statusFilter=""
    onFilterChange={() => undefined} nextCursor={null} onLoadMore={() => undefined} />));
  await render(1);
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="ask-ai-button"]')!.click());
  await render(2);
  expect(host.querySelector('[data-testid="assistance-explanation"]')?.textContent).toBe('Fresh advice');
  await act(async () => finish(new Response(JSON.stringify({
    order_id: baseOrder.id, order_version: 1, buyer_revision: 1, lifecycle: 'pending', context_token: 'old', source: 'local',
    condition: 'UNKNOWN_CAUSE', explanation: 'Outdated advice', reason_codes: [], facts: {}, suggested_actions: [], locale: 'en',
  }))));
  expect(host.textContent).not.toContain('Outdated advice');
  await act(async () => host.querySelectorAll<HTMLButtonElement>('[data-testid="ask-ai-button"]')[1].click());
  expect(host.querySelector('.review-assistant-side-panel')?.textContent).toContain('order-2');
  expect(host.querySelectorAll('[data-testid="review-assistant-panel"]')).toHaveLength(1);
  expect(fetcher.mock.calls).toHaveLength(3);
  await act(async () => root.unmount());
});
