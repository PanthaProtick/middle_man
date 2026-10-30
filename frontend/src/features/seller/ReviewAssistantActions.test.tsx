import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { OrderList } from './OrderList';
import { baseOrder } from './reviewAssistanceTestSupport';

vi.mock('./BuyerCorrection', () => ({ BuyerCorrection: () => <div data-testid="buyer-correction" /> }));
vi.mock('./PaymentException', () => ({ PaymentException: () => <div /> }));
vi.mock('./OrderOutcomes', () => ({ OrderOutcomes: () => <div /> }));
vi.mock('./BuyerLinkAccess', () => ({ BuyerLinkAccess: () => <div /> }));

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; localStorage.clear(); });

it('routes approved card and detail actions to Received Payments and the buyer correction tab', async () => {
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(() => undefined);
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(() => undefined);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({
    order_id: baseOrder.id, order_version: 1, buyer_revision: 1, lifecycle: 'pending',
    context_token: 'current', source: 'local', condition: 'NO_RECORDED_RECEIPT',
    explanation: 'Missing receipt', reason_codes: [], facts: { has_matching_receipt: false }, locale: 'en',
    suggested_actions: [
      { action_id: 'CHECK_TRANSACTIONS', target: 'transactions', label: 'Check transactions' },
      { action_id: 'CORRECT_BUYER_DETAILS', target: 'buyer_tab', label: 'Correct buyer details' },
    ],
  }), { status: 200 }));
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onCheckTransactions = vi.fn();
  await act(async () => root.render(<OrderList token="seller" orders={[baseOrder]} statusFilter=""
    onFilterChange={() => undefined} nextCursor={null} onLoadMore={() => undefined}
    onCheckTransactions={onCheckTransactions} />));
  const click = async (selector: string) => {
    await act(async () => container.querySelector<HTMLButtonElement>(selector)!.click());
  };
  await click('[data-testid="ask-ai-button"]');
  await click('[data-testid="action-CHECK_TRANSACTIONS"]');
  expect(onCheckTransactions).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[data-testid="review-assistant-panel"]')).toBeNull();
  await click('[data-testid="ask-ai-button"]');
  await click('[data-testid="action-CORRECT_BUYER_DETAILS"]');
  const dialog = container.querySelector('dialog')!;
  const correction = dialog.querySelector('[data-testid="buyer-correction"]')!;
  expect(correction.closest('section[role="tabpanel"]')?.hasAttribute('hidden')).toBe(false);
  const paymentTab = dialog.querySelector<HTMLButtonElement>('[id$="-payment-tab"]')!;
  await act(async () => paymentTab.click());
  await click('dialog [data-testid="ask-ai-button"]');
  await click('dialog [data-testid="action-CHECK_TRANSACTIONS"]');
  expect(onCheckTransactions).toHaveBeenCalledTimes(2);
  expect(container.querySelector('dialog')).toBeNull();
  await act(async () => root.unmount());
});
