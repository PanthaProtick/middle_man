import { LocaleProvider } from '../locale/LocaleProvider';
import { LocaleSwitch } from '../locale/LocaleSwitch';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { SmsImportPanel } from './SmsImportPanel';
import type { PaymentAccount } from './types';

const account: PaymentAccount = {
  id: 'a1', shop_id: 's1', provider: 'bkash', receiving_number: '01711111111',
  label: 'Primary', version: 1, is_active: true, created_at: '', updated_at: '',
};
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it('pastes a batch, shows per-item failures and opens manual fallback', async () => {
  const manual = vi.fn();
  const imported = vi.fn();
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
    id: 'batch1', payment_account_id: 'a1', created_at: '', items: [
      { index: 0, state: 'imported', issues: [], receipt_id: 'tx1', fields: { provider: 'bkash', trx_id: 'TEST1', amount_minor: 15000, sender_number: '01799998877', occurred_at: '2026-10-24T06:00:00Z' } },
      { index: 1, state: 'masked', issues: ['sender_number'], receipt_id: null, fields: null },
    ],
  }), { status: 200 }));
  const container = document.createElement('div');
  const root = createRoot(container);
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><SmsImportPanel accounts={[account]} token="seller-token" onImported={imported} onManual={manual} /></LocaleProvider>));
  const textarea = container.querySelector('textarea')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, 'first SMS\n\nsecond SMS');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(fetchSpy).toHaveBeenCalledWith('/api/seller/transactions/sms-import', expect.objectContaining({
    body: JSON.stringify({ payment_account_id: 'a1', messages: ['first SMS', 'second SMS'] }),
    headers: expect.objectContaining({ Authorization: 'Bearer seller-token', 'Idempotency-Key': expect.any(String) }),
  }));
  expect(container.textContent).toContain('masked');
  expect(container.textContent).toContain('TEST1');
  expect(imported).toHaveBeenCalled();
  const button = [...container.querySelectorAll('button')].find(b => b.textContent?.includes('Enter manually'))!;
  await act(async () => button.click());
  expect(manual).toHaveBeenCalledWith('a1');
  await act(async () => root.unmount());
});

it('keeps the retry key after failure, disables controls while pending, and rotates on changed input', async () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  let resolveRequest: (r: Response) => void = () => {};
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementationOnce(() => new Promise<Response>(resolve => { resolveRequest = resolve; }));
  await act(async () => root.render(<LocaleProvider><LocaleSwitch /><SmsImportPanel accounts={[account]} token="token" onImported={() => {}} onManual={() => {}} /></LocaleProvider>));
  const textarea = container.querySelector('textarea')!;
  const change = async (value: string) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const submit = async () => act(async () => { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await change('unknown SMS');
  await submit();
  expect(textarea.disabled).toBe(true);
  expect(container.textContent).toContain('Processing request');
  await act(async () => resolveRequest(new Response(JSON.stringify({error: {code: 'UNAVAILABLE', message: 'Retry this batch'}}), {status: 503})));
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('Retry the same batch');
  expect(textarea.value).toBe('unknown SMS');
  await act(async () => Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'বাংলা')!.click());
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('একই ব্যাচ আবার পাঠান');
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(textarea.value).toBe('unknown SMS');
  fetchSpy.mockRejectedValue(new Error('Offline'));
  await submit();
  const key = (index: number) => new Headers(fetchSpy.mock.calls[index][1]?.headers).get('Idempotency-Key');
  expect(key(1)).toBe(key(0));
  await change('changed SMS');
  await submit();
  expect(key(2)).not.toBe(key(0));
  await act(async () => root.unmount());
});
