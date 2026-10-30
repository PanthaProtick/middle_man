import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ReviewAssistant } from './ReviewAssistant';
import { OrderPaymentDetails } from './OrderPaymentDetails';
import { baseOrder } from './reviewAssistanceTestSupport';
import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';

afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; localStorage.clear(); });

const advice = (id = 'receipt-a', version = 1) => ({
  order_id: baseOrder.id, order_version: baseOrder.version, buyer_revision: baseOrder.buyer_revision,
  lifecycle: 'pending', source: 'local', condition: 'UNKNOWN_CAUSE', context_token: id,
  selected_receipt_id: id, selected_receipt_version: version,
  preview_conditions: ['TRANSACTION_ID_MISMATCH', 'PAYMENT_EXCEEDS_TOTAL'],
  preview_blockers: ['TRANSACTION_ID_MISMATCH', 'PAYMENT_EXCEEDS_TOTAL'],
  reason_codes: [], explanation: 'Selected receipt explanation', facts: {has_matching_receipt: true, total_minor: 10000},
  suggested_actions: [], locale: 'en',
});
const response = (data: unknown) => new Response(JSON.stringify(data));

it('discards late selected advice on selection, receipt version, and preview refresh changes', async () => {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  let finish!: (value: Response) => void;
  const spy = vi.spyOn(globalThis, 'fetch');
  const render = async (id: string, version: number, selectionKey: string) => {
    await act(async () => root.render(<ReviewAssistant order={baseOrder} token="seller"
      receiptId={id} receiptVersion={version} selectionKey={selectionKey} />));
  };
  for (const [id, version, key] of [['receipt-b', 1, 'a'], ['receipt-b', 2, 'a'], ['receipt-b', 2, 'b']] as const) {
    spy.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await act(async () => {
      if (!host.querySelector('button')) await render('receipt-a', 1, 'a');
    });
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="ask-ai-button"]')!.click());
    await render(id, version, key);
    await act(async () => finish(response(advice())));
    expect(host.querySelector('[data-testid="review-assistant-panel"]')).toBeNull();
  }
  await act(async () => root.unmount());
});

it('rejects a response bound to another selected receipt or version', async () => {
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(advice('wrong-receipt', 9)));
  await act(async () => root.render(<ReviewAssistant order={baseOrder} token="seller" receiptId="receipt-a" receiptVersion={1} />));
  await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  expect(host.querySelector('[data-testid="assistance-explanation"]')).toBeNull();
  await act(async () => root.unmount());
});

it('uses payment selection, translates blockers, and preserves the decision draft and controls', async () => {
  localStorage.setItem('middleman.locale', 'en');
  const receipts = ['receipt-a', 'receipt-b'].map(id => ({
    id, provider: 'bkash', trx_id: id, amount_minor: 15000, payment_account_id: 'account', version: 1,
  }));
  const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const path = String(url);
    if (path.includes('review-assistance')) return response(advice(JSON.parse(String(init?.body)).receipt_id));
    if (path.includes('payment-preview')) return response({
      receipt: receipts[path.includes('receipt-b') ? 1 : 0], order_id: baseOrder.id,
      expected_version: baseOrder.version, expected_transaction_version: 1,
      claim_provider: 'bkash', claim_trx_id: 'CLAIM', claim_sender: '01711111111', claim_amount_minor: 10000,
      claim_submitted_at: '2026-10-30T01:00:00Z', order_created_at: '2026-10-30T00:00:00Z',
      account_provider: 'bkash', payment_account_id: 'account', total_minor: 10000,
      required_advance_minor: 10000, accepted_amount_minor: 15000, actual_cod_minor: null,
      exceptions: [], blockers: ['PAYMENT_EXCEEDS_TOTAL'],
    });
    return response({items: receipts});
  });
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  const done = vi.fn();
  await act(async () => root.render(<LocaleProvider><LocaleSwitch />
    <OrderPaymentDetails order={baseOrder} token="seller" onCorrected={done} />
  </LocaleProvider>));
  const select = async (id: string) => act(async () => {
    const field = host.querySelector('select')!; field.value = id;
    field.dispatchEvent(new Event('change', {bubbles: true}));
  });
  await select('receipt-a');
  await act(async () => {
    const field = host.querySelector('textarea')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(field, 'Keep this decision draft');
    field.dispatchEvent(new Event('input', {bubbles: true}));
  });
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="ask-ai-button"]')!.click());
  expect(host.textContent).toContain('Selected receipt acceptance preview');
  expect(host.textContent).toContain('TrxID does not match');
  expect(host.querySelector('textarea')!.value).toBe('Keep this decision draft');
  const count = fetcher.mock.calls.length;
  await act(async () => Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'বাংলা')!.click());
  expect(host.textContent).toContain('TrxID মেলেনি');
  expect(fetcher.mock.calls).toHaveLength(count);
  await select('receipt-b');
  expect(host.querySelector('[data-testid="review-assistant-panel"]')).toBeNull();
  expect(host.querySelector('textarea')!.value).toBe('Keep this decision draft');
  expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  expect(done).not.toHaveBeenCalled();
  await select('');
  expect(host.querySelector('[data-testid="ask-ai-button"]')).not.toBeNull();
  await act(async () => root.unmount());
});
