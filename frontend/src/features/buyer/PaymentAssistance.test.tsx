import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PaymentAssistance } from './PaymentAssistance';
import type { BuyerFormDraft } from './types';
let container: HTMLDivElement;
let root: Root;
beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });
const draft: BuyerFormDraft = { buyer_name: 'Buyer', contact_number: '', address_raw: '', payment_provider: 'bkash', payment_sender: '', payment_trx_id: 'manual', claimed_advance_bdt: '', evidence_id: 'evidence' };
const body = { available: true, evidence_id: 'evidence', review_required: true, suggestions: { is_payment_screenshot: true, provider: 'bkash', trx_id: 'EXTRACTED', amount_minor: 10050, sender_number: null, receiver_number: null, occurred_at: null, unreadable_fields: ['sender_number', 'receiver_number', 'occurred_at'] } };
function button(text: string) { const found = [...container.querySelectorAll('button')].find(b => b.textContent?.includes(text)); if (!found) throw new Error(text); return found; }
it('requires explicit transfer choice and applies suggestions only after review', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body)));
  const use = vi.fn();
  await act(async () => root.render(<PaymentAssistance portalToken="token" draft={draft} onUse={use} disabled={false} />));
  expect(fetcher).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Google Gemini');
  await act(async () => button('Send screenshot').click());
  expect(use).not.toHaveBeenCalled();
  expect(container.textContent).toContain('sender_number');
  await act(async () => button('Use reviewed').click());
  expect(use).toHaveBeenCalledWith(expect.objectContaining({ payment_trx_id: 'EXTRACTED', claimed_advance_bdt: '100.50' }));
});

it.each([{}, { ...body, suggestions: { ...body.suggestions, amount_minor: '100' } }, { ...body, available: false }, { ...body, evidence_id: 'foreign' }])('preserves manual fields for malformed or unavailable results', async result => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(result)));
  const use = vi.fn();
  await act(async () => root.render(<PaymentAssistance portalToken="token" draft={draft} onUse={use} disabled={false} />));
  await act(async () => button('Send screenshot').click());
  expect(container.textContent).toContain('Enter payment details manually');
  expect(use).not.toHaveBeenCalled();
});

it('discards late output after manual review and reuses the key on retry', async () => {
  let resolve!: (value: Response) => void;
  const fetcher = vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise<Response>(done => { resolve = done; }));
  const use = vi.fn();
  await act(async () => root.render(<PaymentAssistance portalToken="token" draft={draft} onUse={use} disabled={false} />));
  await act(async () => button('Send screenshot').click());
  const key = (fetcher.mock.calls[0][1]!.headers as Record<string, string>)['Idempotency-Key'];
  await act(async () => root.render(<PaymentAssistance portalToken="token" draft={{ ...draft, payment_trx_id: 'REVIEWED' }} onUse={use} disabled={false} />));
  await act(async () => resolve(new Response(JSON.stringify(body))));
  expect(container.textContent).not.toContain('Use reviewed');
  expect(use).not.toHaveBeenCalled();
  fetcher.mockResolvedValue(new Response(JSON.stringify(body)));
  await act(async () => button('Send screenshot').click());
  expect((fetcher.mock.calls[1][1]!.headers as Record<string, string>)['Idempotency-Key']).toBe(key);
});

it('unknown fields preserve existing manual values and non-payment screenshots cannot be applied', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ...body, suggestions: { ...body.suggestions, trx_id: null, amount_minor: null, provider: null } })));
  const use = vi.fn();
  await act(async () => root.render(<PaymentAssistance portalToken="token" draft={draft} onUse={use} disabled={false} />));
  await act(async () => button('Send screenshot').click());
  await act(async () => button('Use reviewed').click());
  expect(use).toHaveBeenCalledWith({});
  fetcher.mockResolvedValue(new Response(JSON.stringify({ ...body, suggestions: { ...body.suggestions, is_payment_screenshot: false } })));
  await act(async () => button('Send screenshot').click());
  expect(button('Use reviewed').disabled).toBe(true);
});

it('keeps manual entry available on network failure', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'));
  await act(async () => root.render(<PaymentAssistance portalToken="token" draft={draft} onUse={vi.fn()} disabled={false} />));
  await act(async () => button('Send screenshot').click());
  expect(container.textContent).toContain('Enter payment details manually');
  expect(button('Send screenshot').disabled).toBe(false);
});
