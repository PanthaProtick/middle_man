import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { LocaleProvider } from '../locale/LocaleProvider';
import { ManualTransactionModal } from './ManualTransactionModal';

const account = {
  id: 'account', shop_id: 'shop', provider: 'bkash' as const, receiving_number: '01711223344',
  label: 'Shop account', is_active: true, version: 1, created_at: '', updated_at: '',
};

afterEach(() => {
  vi.restoreAllMocks(); localStorage.clear(); document.body.innerHTML = '';
});

it('prefills the payment time with the current local minute and records it untouched', async () => {
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'receipt' })));
  const host = document.createElement('div'); document.body.append(host); const root = createRoot(host);
  try {
    await act(async () => root.render(
      <LocaleProvider>
        <ManualTransactionModal accounts={[account]} onClose={vi.fn()} onTransactionRecorded={vi.fn()} />
      </LocaleProvider>,
    ));
    const time = host.querySelector<HTMLInputElement>('#manual-time')!;
    expect(time.value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(Math.abs(Date.parse(time.value) - Date.now())).toBeLessThan(120_000);
    await act(async () => {
      for (const [id, value] of [['manual-trxId', 'DEFAULT-TIME'], ['manual-amount', '150']] as const) {
        const input = host.querySelector<HTMLInputElement>(`#${id}`)!;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
      trx_id: 'DEFAULT-TIME', amount_minor: 15000, occurred_at: new Date(time.value).toISOString(),
    });
  } finally {
    await act(async () => root.unmount()); host.remove();
  }
});
