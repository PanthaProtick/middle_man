import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ReviewAssistant } from './ReviewAssistant';
import { baseOrder } from './reviewAssistanceTestSupport';
import type { SellerOrder } from './types';

const advice = {
  order_id: baseOrder.id, order_version: 1, buyer_revision: 1, lifecycle: 'pending',
  context_token: 'original', source: 'local', condition: 'NO_RECORDED_RECEIPT',
  explanation: 'Missing receipt', reason_codes: [], facts: { has_matching_receipt: false },
  suggested_actions: [{ action_id: 'CHECK_TRANSACTIONS', target: 'transactions', label: 'Check transactions' }],
  locale: 'en',
};
const response = (data = advice) => new Response(JSON.stringify(data), { status: 200 });

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; localStorage.clear(); });

async function mount() {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onAction = vi.fn();
  const render = async (order = baseOrder, token: string | undefined = 'seller', receiptId?: string) => {
    await act(async () => root.render(<ReviewAssistant order={order} token={token}
      receiptId={receiptId} onAction={onAction} />));
  };
  const click = async (selector = '[data-testid="ask-ai-button"]') => {
    await act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
  };
  await render();
  return { container, root, render, click, onAction };
}

it('retries an error in the open panel and prevents duplicate requests', async () => {
  let finish!: (response: Response) => void;
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('private failure'))
    .mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const view = await mount();
  await view.click();
  expect(view.container.textContent).not.toContain('private failure');
  await view.click('[data-testid="review-assistant-panel"] button.btn');
  await view.click();
  expect(fetchSpy).toHaveBeenCalledTimes(2);
  await act(async () => finish(response()));
  expect(view.container.querySelector('[data-testid="assistance-explanation"]')).not.toBeNull();
  await act(async () => view.root.unmount());
});

it.each([
  ['order', { ...baseOrder, id: 'order-2' }, 'seller', undefined],
  ['shop', { ...baseOrder, shop_id: 'shop-2' }, 'seller', undefined],
  ['version', { ...baseOrder, version: 2 }, 'seller', undefined],
  ['revision', { ...baseOrder, buyer_revision: 2 }, 'seller', undefined],
  ['reasons', { ...baseOrder, review_reasons: ['NEW_REASON'] }, 'seller', undefined],
  ['lifecycle', { ...baseOrder, lifecycle: 'confirmed' }, 'seller', undefined],
  ['session', baseOrder, 'other-seller', undefined],
  ['sign-out', baseOrder, '', undefined],
  ['receipt', baseOrder, 'seller', 'receipt-2'],
] satisfies [string, SellerOrder, string, string | undefined][])(
  'discards late advice after %s changes and does not resurrect it', async (_name, order, token, receiptId) => {
    let finish!: (response: Response) => void;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const view = await mount();
    await view.click();
    await view.render(order, token, receiptId);
    await act(async () => finish(response()));
    expect(view.container.querySelector('[data-testid="assistance-explanation"]')).toBeNull();
    await view.render();
    expect(view.container.querySelector('[data-testid="review-assistant-panel"]')).toBeNull();
    await act(async () => view.root.unmount());
  }
);

it('revalidates hidden receipt changes on reopen and on focus without navigating stale actions', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response());
  const view = await mount();
  await view.click();
  await view.click();
  const changed = { ...advice, context_token: 'changed', condition: 'UNKNOWN_CAUSE' };
  fetchSpy.mockImplementation(async () => response(changed));
  await view.click();
  expect(view.container.textContent).toContain('unknown reason');
  expect(fetchSpy).toHaveBeenCalledTimes(2);
  fetchSpy.mockImplementation(async () => response({ ...changed, context_token: 'changed-again' }));
  await view.click('[data-testid="action-CHECK_TRANSACTIONS"]');
  expect(view.onAction).not.toHaveBeenCalled();
  await view.click('[data-testid="action-CHECK_TRANSACTIONS"]');
  expect(view.onAction).toHaveBeenCalledWith('CHECK_TRANSACTIONS');
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(fetchSpy).toHaveBeenCalledTimes(5);
  await act(async () => view.root.unmount());
});

it('clears visible advice when authorization fails during revalidation', async () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response());
  const view = await mount();
  await view.click();
  fetchSpy.mockImplementation(async () => new Response('{}', { status: 401 }));
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(view.container.querySelector('[data-testid="assistance-explanation"]')).toBeNull();
  expect(view.container.textContent).toContain('Unable to load');
  await act(async () => view.root.unmount());
});

it('rejects a response describing a newer server order until the view refreshes', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => response({ ...advice, order_version: 2 }));
  const view = await mount();
  await view.click();
  expect(view.container.querySelector('[data-testid="assistance-explanation"]')).toBeNull();
  await act(async () => view.root.unmount());
});
