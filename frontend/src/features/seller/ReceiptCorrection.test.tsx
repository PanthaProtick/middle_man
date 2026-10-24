import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ReceiptCorrection } from './ReceiptCorrection';
import type { ReceiptView } from './types';

const receipt: ReceiptView = {
  id: 'receipt', shop_id: 'shop', payment_account_id: 'account', provider: 'bkash', trx_id: 'OLD',
  amount_minor: 200001, sender_number_raw: '01822222222', occurred_at: '2026-10-24T10:00:00Z',
  reconciliation_state: 'unmatched', has_conflict: false, version: 2, observations: [], related_claims_count: 1,
  created_at: '2026-10-24T09:00:00Z', updated_at: '2026-10-24T10:00:00Z',
};
afterEach(() => vi.restoreAllMocks());

async function mount() {
  const onCorrected = vi.fn(); const onStale = vi.fn().mockResolvedValue(undefined); const onPending = vi.fn();
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<ReceiptCorrection receipt={receipt} accounts={[]} token="seller"
    disabled={false} onCorrected={onCorrected} onPending={onPending} onStale={onStale} />));
  async function change(label: string, value: string) {
    await act(async () => {
      const node = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
      const prototype = node.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(node, value);
      node.dispatchEvent(new Event('input', {bubbles: true}));
    });
  }
  const submit = async () => act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})); });
  const cleanup = async () => { await act(async () => root.unmount()); container.remove(); };
  return {container, change, submit, cleanup, onCorrected, onStale, onPending};
}

it('preserves exact correction key and payload for unstructured server outages and shows the outcome', async () => {
  const requests: RequestInit[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
    requests.push(init!); return new Response('Unavailable', {status: 503});
  }).mockImplementationOnce(async (_url, init) => {
    requests.push(init!); return new Response(JSON.stringify({receipt: {...receipt, version: 4}, allocated_order_id: 'order'}));
  });
  const ui = await mount();
  expect(ui.container.textContent).toContain('Before: bkash / OLD');
  await ui.change('Correction amount', '2000.00');
  await ui.change('Correction reason', 'Checked app amount');
  await ui.submit();
  expect(ui.container.textContent).toContain('Retry same correction');
  expect(ui.container.querySelector('fieldset')?.disabled).toBe(true);
  await ui.submit();
  expect(requests[0]?.body).toBe(requests[1]?.body);
  expect(requests[0]?.headers).toEqual(requests[1]?.headers);
  expect(JSON.parse(String(requests[0]?.body))).toMatchObject({amount_minor: 200000, expected_version: 2, reason: 'Checked app amount'});
  expect(ui.onCorrected).toHaveBeenCalledWith(expect.objectContaining({allocated_order_id: 'order'}));
  await ui.cleanup();
});

it('keeps collision edits actionable and refetches stale evidence before another write', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({error: {
    code: 'RECEIPT_IDENTITY_COLLISION', message: 'Compare and explicitly resolve existing receipt'} }), {status: 409}))
    .mockResolvedValueOnce(new Response(JSON.stringify({error: {code: 'STALE_VERSION', message: 'Refresh evidence'} }), {status: 409}));
  const ui = await mount();
  await ui.change('Correction TrxID', 'EXISTING'); await ui.change('Correction reason', 'Checked identity');
  await ui.submit();
  expect(ui.container.textContent).toContain('Compare and explicitly resolve');
  expect(ui.container.querySelector<HTMLInputElement>('[aria-label="Correction TrxID"]')?.value).toBe('EXISTING');
  expect(ui.container.querySelector('fieldset')?.disabled).toBe(false);
  await ui.change('Correction TrxID', 'CORRECT'); await ui.submit();
  expect(ui.onStale).toHaveBeenCalledOnce();
  expect(ui.container.querySelector('fieldset')?.disabled).toBe(true);
  await ui.cleanup();
});

it('validates sender and timezone locally and reports permission denial without claiming success', async () => {
  const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({error: {
    code: 'UNAUTHORIZED', message: 'Seller sign-in required'} }), {status: 401}));
  const ui = await mount(); await ui.change('Correction reason', 'Checked');
  await ui.change('Correction sender', 'invalid'); await ui.submit();
  expect(spy).not.toHaveBeenCalled();
  expect(ui.container.textContent).toContain('Invalid Bangladeshi phone');
  await ui.change('Correction sender', '01822222222'); await ui.change('Correction time', '2026-10-24T12:00:00'); await ui.submit();
  expect(spy).not.toHaveBeenCalled(); expect(ui.container.textContent).toContain('timezone');
  await ui.change('Correction time', ''); await ui.submit();
  expect(ui.container.textContent).toContain('Seller sign-in required'); expect(ui.onCorrected).not.toHaveBeenCalled();
  await ui.cleanup();
});

it('shows loading, freezes edits and prevents duplicate writes until the outcome arrives', async () => {
  let finish: (response: Response) => void = () => {};
  const spy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
  const ui = await mount(); await ui.change('Correction reason', 'Checked receipt');
  await ui.submit();
  expect(ui.container.textContent).toContain('Saving correction');
  expect(ui.container.querySelector('fieldset')?.disabled).toBe(true);
  expect(ui.onPending).toHaveBeenCalledWith(true);
  await ui.submit(); expect(spy).toHaveBeenCalledOnce();
  await act(async () => finish(new Response(JSON.stringify({receipt, allocated_order_id: null}))));
  expect(ui.onPending).toHaveBeenLastCalledWith(false);
  expect(ui.onCorrected).toHaveBeenCalledOnce();
  await ui.cleanup();
});
